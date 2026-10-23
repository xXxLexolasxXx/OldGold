'use strict';
// Управление рабочими (по отзыву тестера: «автоматика в лейтгейме подводит, рабочие не хотят работать»).
//  · вкладка «Приоритеты» → «Рабочие»: кто чем занят, кто стоит и почему, сколько выпускать на работу;
//  · закрепить работягу за стройкой/зданием, курьеру задать маршрут «откуда → куда» (мельница → склад);
//  · «Отдыхать» — гном не берёт работу; лимит «на работе: N» для работяг, трудяг и извозчиков;
//  · карточка гнома по тапу: чем занят или почему стоит, кнопка «Пнуть» (герой пинает лентяя, кулдаун).
// По умолчанию ничего не задано — работает прежняя автоматика. Сохранение — поле wk.
// Читают: logistics.js (wkMay, wkTrim, wkPinnedCouriers, wkPinnedBuilders), coopsim (через обёртку coopCmd), coopclient (t:'wk').

const WK_JOBS = ['builder', 'serf', 'carter'];          // кого можно закреплять и ограничивать (козы — вместе с извозчиками)
const WK_KICK_CD = 25, WK_HERO_CD = 3, WK_KICK_NEAR = 3.5, WK_KICK_BOOST = 30;
const WK_SYL1 = ['Бо', 'Гру', 'Дор', 'Ту', 'Хар', 'Ми', 'Ско', 'Фли', 'Бра', 'Ку', 'Гло', 'Ну'];
const WK_SYL2 = ['рин', 'мли', 'нок', 'бур', 'фин', 'док', 'ган', 'ли', 'рт', 'мбо', 'зя', 'дрик'];
const wkName = u => t(WK_SYL1[(u.look | 0) % WK_SYL1.length]) + t(WK_SYL2[((u.look | 0) * 7 + u.id) % WK_SYL2.length]);   // t() — слоги склеиваются в имя, переводим по частям
const wkJob = u => prioJobKey(u);
const wkManaged = u => !!u && WK_JOBS.includes(wkJob(u));
// кого показываем в карточке: рабочие профессии, без героя, напарников, рекрутов, глав гильдий
function wkEligible(u) {
  if (!u || u.dead || u.type === 'hero' || u.teamOf || u.gx || u.gm || u.kid) return false;
  if (typeof recOf === 'function' && recOf(u)) return false;
  return prioJobList().includes(wkJob(u));
}
const wkSelectable = u => wkEligible(u) && !u.inside;

function wkState() { return Game.wk || (Game.wk = { cap: {} }); }
const wkBoosted = u => Game.time < (u.kickUntil || 0);    // пнутый — полчаса работает, даже если «отдыхает» или сверх лимита
// может ли гном брать работу вообще
function wkMay(u) { return wkBoosted(u) || !(u.wk && u.wk.off); }
const wkCap = job => { const c = Game.wk && Game.wk.cap[job]; return c === undefined ? Infinity : c; };

// Лимит «на работе»: свободных пускаем столько, чтобы занятых было не больше лимита
function wkTrim(idle) {
  if (!Game.wk || !Object.keys(Game.wk.cap).length) return idle;
  const busy = {};
  for (const u of Game.units) if (!u.dead && !u.idleFlag && wkManaged(u)) busy[wkJob(u)] = (busy[wkJob(u)] || 0) + 1;
  const left = {};
  idle.sort((a, b) => wkBoosted(b) - wkBoosted(a));
  return idle.filter(u => {
    const j = wkJob(u), c = wkCap(j);
    if (c === Infinity || wkBoosted(u)) return true;
    if (left[j] === undefined) left[j] = c - (busy[j] || 0);
    return left[j]-- > 0;
  });
}

const wkB = id => { const b = id != null && Game.buildings.find(x => x.id === id); return b && !b.removed ? b : null; };

// Работяга, закреплённый за зданием: берёт только его стройку, достройку и ремонт
function wkPinnedBuilders(idle) {
  for (let i = idle.length - 1; i >= 0; i--) {
    const u = idle[i], p = u.wk;
    if (!p || p.b == null) continue;
    idle.splice(i, 1);
    const b = wkB(p.b);
    if (!b) { u.wk = null; continue; }            // здание снесли — закрепление снимаем, гном снова на автоматике
    const go = () => { u.idleFlag = false; u.idleStreak = 0; u.proc = null; u.action = null; u.anim = null; };
    if (b.state !== 'done' && !b.builder && !b.selfBuild && !b.hold && !prioBlocked(b)) { b.builder = u; u.job = b; go(); }
    else if (b.upg && !b.upg.builder) { b.upg.builder = u; u.job = b; go(); }
    else if (b.dmg > 0.05 && !b.repairer) { b.repairer = u; u.repairJob = b; go(); }
  }
}

// Курьер с маршрутом: from/to — id здания, 'store' (любой склад) или null (откуда/куда угодно)
function wkSameNet(a, b) {
  if (a.isPile || b.isPile || b.isRoad) return true;
  const ca = compAt(a.doorX, a.doorY), cb = compAt(b.doorX, b.doorY);
  return !ca || !cb || ca === cb;
}
function wkPinnedCouriers(idle) {
  for (let i = idle.length - 1; i >= 0; i--) {
    const u = idle[i], p = u.wk;
    if (!p || (p.from == null && p.to == null)) continue;
    idle.splice(i, 1);
    if ((typeof p.from === 'number' && !wkB(p.from)) || (typeof p.to === 'number' && !wkB(p.to))) { u.wk = null; continue; }
    wkRoute(u, p);
  }
}
function wkRoute(u, p) {
  const done = b => b.state === 'done' && !b.removed;
  const srcs = p.from === 'store' ? Game.buildings.filter(b => b.isStore()) : typeof p.from === 'number' ? [wkB(p.from)] :
    [...Game.buildings.filter(done), ...Game.piles.values()];
  const go = (src, dst, g, n) => { n = Math.min(n, src.offer(g), carryCap(u)); if (n > 0) { assignDelivery(u, src, dst, g, n); return true; } return false; };
  // 1) заявки адресата: материалы на стройку, сырьё в цех
  if (p.to !== 'store') {
    const dsts = typeof p.to === 'number' ? [wkB(p.to)] : [...Game.buildings, ...Game.roadSites.values()];
    for (const d of dsts) {
      if (d.isStore && d.isStore() && !d.upg) continue;
      if (prioBlocked(d)) continue;
      for (const g of GOOD_KEYS) {
        const n = d.demand(g);
        if (n <= 0 || !canCarry(u, g)) continue;
        let src = null, sd = 1e9;
        for (const o of srcs) {
          if (o === d || o.offer(g) <= 0 || !wkSameNet(o, d)) continue;
          const dd = mdist(o.doorX, o.doorY, d.doorX, d.doorY);
          if (dd < sd) { sd = dd; src = o; }
        }
        if (src && go(src, d, g, n)) return true;
      }
    }
  }
  // 2) продукцию и рассыпанное — на склад (любой или указанный)
  if (p.to == null || p.to === 'store' || (wkB(p.to) && wkB(p.to).isStore())) {
    for (const src of srcs) {
      if (!src.isPile && (src.isStore() || !src.def.outputs)) continue;
      for (const g of src.isPile ? GOOD_KEYS : Object.keys(src.def.outputs)) {
        if (src.offer(g) <= 0 || !canCarry(u, g)) continue;
        const st = typeof p.to === 'number' ? (Game.storeBlock[g] ? null : wkB(p.to)) : nearestStore(src.doorX, src.doorY, g);
        if (st && wkSameNet(src, st) && go(src, st, g, src.offer(g))) return true;
      }
    }
  }
  return false;
}

// ---------- Чем занят / почему стоит ----------
const wkBN = b => b ? (b.isRoad ? 'дорога' : (b.def && b.def.name) || 'здание') : '?';
const wkGN = g => (GOODS[g] && GOODS[g].name || g).toLowerCase();
const BRK_WHY = { smoke: 'на перекуре', join: 'на перекуре за компанию', sleep: 'спит (перебрал)', faint: 'без сил, лежит', sick: 'болеет', rest: 'отдыхает', knock: 'приходит в себя после пинка', freeze: 'замёрз', flee: 'убегает от опасности', rain: 'прячется от дождя', sulk: 'обиделся и дуется', wander: 'гуляет', feast: 'на празднике' };

function wkDoing(u) {
  if (u.dlv && u.dlv.to) return `несёт ${wkGN(u.dlv.g)}${u.dlv.n > 1 ? ' ×' + u.dlv.n : ''} → ${wkBN(u.dlv.to)}`;
  if (u.eat) return 'идёт поесть';
  if (u.repairJob) return 'чинит: ' + wkBN(u.repairJob).toLowerCase();
  if (u.fieldJob >= 0) return 'вскапывает поле';
  if (u.helpField >= 0) return 'помогает убрать урожай';
  if (u.job && !u.job.removed) return (u.job.upg && u.job.state === 'done' ? 'достраивает: ' : 'строит: ') + wkBN(u.job).toLowerCase();
  if (u.home && !u.home.removed && !u.home.problem()) return 'работает: ' + wkBN(u.home).toLowerCase();
  return '';
}

function wkWhy(u) {
  if (u.dead || u.type === 'hero') return '';
  if (u.brk) return BRK_WHY[u.brk.kind] || 'на перерыве';
  if (u.wk && u.wk.off && !wkBoosted(u)) return 'отдыхает по вашему приказу';
  if (prioJobLv(u) === 0) return 'профессия выключена в «Приоритетах»';
  const job = wkJob(u);
  if (u.home && !u.home.removed) {
    const p = u.home.problem();
    if (!p) return '';
    if (p.startsWith('need:')) return 'нет сырья: ' + wkGN(p.slice(5)) + ' — ждёт подвоза';
    return { enough: 'еды на складе вдоволь — отдыхает', full: 'склад здания полон — ждёт, пока вывезут', paused: 'здание на паузе', noroad: 'к зданию нет дороги', damaged: 'здание повреждено — ждёт ремонта', noworker: 'идёт на работу' }[p] || '';
  }
  if (!u.idleFlag) return '';
  if (wkManaged(u) && wkCap(job) < Infinity) {
    const busy = Game.units.filter(x => !x.dead && !x.idleFlag && wkJob(x) === job).length;
    if (busy >= wkCap(job)) return `лишний: лимит «на работе» — ${wkCap(job)}`;
  }
  if (u.isCourier) {
    if (u.wk && (u.wk.from != null || u.wk.to != null)) return 'ждёт груз по маршруту ' + wkRouteName(u.wk);
    if (prioLv('jobs', job) === 1) return 'приоритет «Низкий»: ждёт, пока разберут другие';
    return 'нечего везти: заявки разобраны (или рядом нет дороги)';
  }
  if (u.type === 'builder') {
    if (u.wk && u.wk.b != null) return `закреплён: ${wkBN(wkB(u.wk.b)).toLowerCase()} — там пока нечего делать`;
    const sites = Game.buildings.filter(b => b.state !== 'done' && !b.selfBuild && !b.hold);
    if (!sites.length && !Game.roadSites.size) return 'нет строек — поставьте здание или дорогу';
    if (sites.length && sites.every(b => prioBlocked(b))) return 'стройка выключена в «Приоритетах»';
    if (sites.length && sites.every(b => b.builder)) return 'все стройки уже заняты';
    const need = new Set();
    for (const b of sites) for (const k of ['trunk', 'timber', 'stone']) if (b.demand(k) > 0) need.add(wkGN(k));
    return need.size ? 'стройки ждут материал: ' + [...need].join(', ') : 'ждёт, пока освободится стройка';
  }
  const bts = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].worker === u.type);
  if (bts.length > 1) return `все мастерские заняты (${bts.length}) — постройте ещё одну`;   // кузнец: 4 цеха
  return bts.length ? `нет свободного здания: «${BUILDINGS[bts[0]].name}»` : 'нет работы';
}

function wkRouteName(p) {
  const n = k => k === 'store' ? 'склад' : k == null ? 'куда угодно' : wkBN(wkB(k)).toLowerCase();
  return (p.from == null ? 'отовсюду' : n(p.from)) + ' → ' + n(p.to);
}

// На сервере и в одиночной игре — раз в ~1 с: в коопе строки уходят клиентам (COOP_UNIT_EX)
function wkWhyAll() {
  for (const u of Game.units) {
    if (u.dead || u.type === 'hero' || !prioJobList().includes(wkJob(u))) continue;
    u.why = wkWhy(u) || undefined;
    u.doing = u.why ? undefined : (wkDoing(u) || undefined);
  }
}

// ---------- Пинок ----------
const WK_HERO_LINES = ['А ну работать!', 'Подъём, лентяй!', 'Кто не работает — тот не ест!', 'Тут тебе не курорт!', 'Пинок — лучший мотиватор!', 'Золото само не накопается!'];
const WK_OK_LINES = ['Ай! Иду-иду!', 'Уже бегу, начальник!', 'Да я просто думал…', 'За что?!', 'Ладно, ладно…', 'Я вообще-то медитировал'];
const WK_SHOUT = ['Эй, ты! Работать!', 'Я всё вижу!', 'Шевелись!'];
const pick = a => a[(Math.random() * a.length) | 0];
const WK_NOKICK = new Set(['sleep', 'faint', 'sick', 'freeze', 'flee', 'knock', 'fight', 'brawl', 'lost', 'burn']);

// Можно ли пнуть: стоит без дела или на перекуре/отдыхе (спящего, больного, дерущегося — нельзя)
function wkKickable(u) {
  if (!wkSelectable(u)) return false;
  if (u.brk) return !WK_NOKICK.has(u.brk.kind);
  return !!(u.idleFlag || u.why);
}

// h — герой, который пинает; возвращает текст для игрока (ошибка) или ''
function wkKick(h, u) {
  if (!h || h.dead) return 'Пинать некому: героя нет';
  if (!u || !wkKickable(u)) return 'Он и так при деле';
  if (Game.time < (h.kickCD || 0)) return 'Нога ещё не отдохнула';
  if (Game.time < (u.kickAt || 0) + WK_KICK_CD) return 'Он ещё от прошлого пинка не отошёл';
  h.kickCD = Game.time + WK_HERO_CD;
  u.kickAt = Game.time;
  u.kickUntil = Game.time + WK_KICK_BOOST;
  Game.kicks = (Game.kicks || 0) + 1;
  const why = wkWhy(u);
  const near = Math.hypot(h.x - u.x, h.y - u.y) <= WK_KICK_NEAR;
  h.gest = near ? 'fist' : 'point'; h.gestUntil = Game.time + 0.8; h.gestFace = u.x >= h.x ? 1 : -1;
  floater(h.x, h.y - 1.7, near ? pick(WK_HERO_LINES) : pick(WK_SHOUT), '#f6d458');
  // с перекура и отдыха — сразу к прерванному делу
  if (u.brk) { if (u.brk.kind === 'smoke' || u.brk.kind === 'join') u.nextSmoke = Game.time + SMOKE_CD_MIN; endBreak(u); }
  const nothing = !u.home && why && /^(нет |нечего|стройки ждут|все стройки|ждёт|закреплён|стройка выкл|профессия)/.test(why);
  const line = nothing ? 'Ай! Так ' + why.replace(/ — .*/, '') + '!' : pick(WK_OK_LINES);
  if (near && !u.inside && (u.idleFlag || !u.proc || !u.action || u.action.wait !== undefined)) {
    let dx = u.x - h.x, dy = u.y - h.y, d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    let L = 0.9;
    while (L > 0.2 && !isWalkable(Math.floor(u.x + dx * L), Math.floor(u.y + dy * L))) L -= 0.3;
    if (u.idleFlag) { u.idleFlag = false; u.action = null; u.anim = null; u.proc = wkKickGen(u, dx * L, dy * L); }
  }
  floater(u.x, u.y - 1.4, line, nothing ? '#ffc8a0' : '#fff6d0');
  return '';
}
function* wkKickGen(u, dx, dy) {
  try {
    u.knock = { x0: u.x, y0: u.y, dx, dy };
    u.face = dx > 0 ? -1 : 1;
    u.ouchUntil = Game.time + 1.6;
    yield { wait: 0.38, anim: 'fly' };
    u.x = u.knock.x0 + dx; u.y = u.knock.y0 + dy;
    u.knock = null;
    yield { wait: 0.3 };
  } finally { u.knock = null; }
}

// ---------- Команды (одиночная игра и сервер) ----------
function wkPinValid(u, p) {
  if (p === null) return true;
  if (!p || typeof p !== 'object') return false;
  if (p.off) return Object.keys(p).length === 1 && p.off === 1;
  const ref = k => k == null || k === 'store' || (Number.isInteger(k) && !!wkB(k));
  if (u.type === 'builder') return Number.isInteger(p.b) && !!wkB(p.b) && Object.keys(p).length === 1;
  if (u.isCourier) return ref(p.from) && ref(p.to) && (p.from != null || p.to != null) && Object.keys(p).every(k => k === 'from' || k === 'to');
  return false;
}
function wkSetPin(u, p) {
  if (!wkEligible(u) || !wkManaged(u) || !wkPinValid(u, p)) return false;
  // закрепление переназначает: бросаем текущую автоматическую работу (не трогаем доставку с грузом в руках)
  u.wk = p || null;
  wkRelease(u);
  return true;
}
// Закреплённый работяга (или «отдыхающий») не держит чужую стройку: снимаем и сразу при закреплении,
// и потом на каждом такте диспетчера — он мог быть на перекуре или нести материал и вернуться к старому делу
function wkRelease(u) {
  const p = u.wk;
  if (!p || u.type !== 'builder' || !u.job || u.inside || u.carry || wkBoosted(u) && p.off) return;
  if (!p.off && u.job.id === p.b) return;
  if (u.job.builder === u) u.job.builder = null;
  if (u.job.upg && u.job.upg.builder === u) u.job.upg.builder = null;
  u.job = null;
  if (u.brk) { if (u.brk.saved) u.brk.saved = { proc: null, action: null }; }
  else { u.proc = null; u.action = null; u.anim = null; }
}
function wkSetCap(job, v) {
  if (!WK_JOBS.includes(job)) return false;
  const st = wkState();
  if (v === null || v === undefined) delete st.cap[job];
  else if (Number.isInteger(v) && v >= 0 && v <= 999) st.cap[job] = v;
  else return false;
  return true;
}
function wkAny() { return !!Game.wk && (Object.keys(Game.wk.cap).length > 0 || Game.units.some(u => u.wk)); }

// сервер: команда игрока name; hero — его герой
function wkCmd(m, hero, canManage, say) {
  if (m.a === 'kick') { const e = wkKick(hero, Game.unitMap.get(m.id)); if (e) say(e); return null; }
  if (!canManage()) return null;
  if (m.a === 'pin') { const u = Game.unitMap.get(m.id); if (u) wkSetPin(u, m.p === undefined ? null : m.p); return null; }
  if (m.a === 'cap') { wkSetCap(m.job, m.v); return { t: 'wk', cap: Game.wk.cap }; }
  if (m.a === 'reset') { wkReset(); return { t: 'wk', cap: {} }; }
  return null;
}
function wkReset() { Game.wk = { cap: {} }; for (const u of Game.units) u.wk = null; }

// ---------- Сохранение, сброс, диспетчер ----------
{
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.wk = { cap: {} }; };
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg();
    if (wkAny()) {
      const pins = [];
      Game.units.forEach((u, i) => { if (u.wk) pins.push([i, u.wk]); });
      s.wk = { cap: Game.wk.cap, pins };
    }
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    Game.wk = { cap: {} };
    const w = s.wk;
    if (!w || typeof w !== 'object') return;
    for (const k in w.cap || {}) wkSetCap(k, w.cap[k]);
    for (const [i, p] of Array.isArray(w.pins) ? w.pins : []) { const u = Game.units[i]; if (u) wkSetPin(u, p); }
  };
  const _da = dispatchAll;
  let whyT = 0;
  dispatchAll = function () { for (const u of Game.units) if (u.wk) wkRelease(u); _da(); wkHook(); if ((whyT += 1) >= 3) { whyT = 0; wkWhyAll(); } };
}

// Подключение к коопу: ленивое — coopsim и coopclient грузятся позже
let wkHooked = false;
function wkHook() {
  if (wkHooked) return;
  if (typeof COOP_UNIT_EX !== 'undefined') for (const k of ['wk', 'why', 'doing', 'kickAt']) if (!COOP_UNIT_EX.includes(k)) COOP_UNIT_EX.push(k);
  if (typeof coopCmd === 'function' && typeof coop !== 'undefined') {
    const _cc = coopCmd;
    coopCmd = function (name, json, admin) {
      let m = null;
      try { m = JSON.parse(json); } catch (e) { return; }
      if (m && m.t === 'wk') {
        const say = t => coopSay(name, t);
        const can = () => { if (admin || coop.perms.manage) return true; say('Хост запретил: ' + COOP_PERMS.manage.toLowerCase()); return false; };
        const out = wkCmd(m, coop.players.get(name), can, say);
        if (out) coop.out.push({ msg: out });
        return;
      }
      return _cc(name, json, admin);
    };
  }
  if (typeof COOP_UNIT_EX !== 'undefined') wkHooked = true;
}
// клиент: снимок лимитов от сервера
function wkApply(m) { Game.wk = { cap: {} }; for (const k in (m && m.cap) || {}) wkSetCap(k, m.cap[k]); }

// ---------- Интерфейс ----------
const wkMirror = () => !!Game.coop;
function wkSend(m) {
  if (wkMirror()) { coopSend(Object.assign({ t: 'wk' }, m)); return; }
  wkCmd(m, Game.hero, () => true, toast);
  wkWhyAll();
  updateUI(true);
}

const WK_JOB_NAME = { builder: 'Работяги', serf: 'Трудяги', carter: 'Извозчики и козы' };
function wkStatus(u) {
  // в коопе строки приходят с сервера; в одиночной игре считаем сразу
  const why = wkMirror() ? u.why : wkWhy(u), doing = wkMirror() ? u.doing : wkDoing(u);
  return { why: why || '', doing: doing || '' };
}
function wkPinLabel(u) {
  const p = u.wk;
  if (!p) return '';
  if (p.off) return 'отдыхает';
  if (p.b != null) return 'за зданием: ' + wkBN(wkB(p.b)).toLowerCase();
  return 'маршрут: ' + wkRouteName(p);
}

function wkListHTML() {
  const units = Game.units.filter(u => !u.dead && u.type !== 'hero' && prioJobList().includes(wkJob(u)) && !u.teamOf && !(typeof recOf === 'function' && recOf(u)));
  let free = 0;
  const st = units.map(u => { const s = wkStatus(u); if (s.why) free++; return [u, s]; });
  let h = `<div class="pr-intro">Кто чем занят и почему стоит. Тап по гному — карточка: закрепить за стройкой, маршрут курьера, <b>пинок</b> героем. «На работе» — сколько гномов профессии работают одновременно.</div>`;
  h += `<div class="wk-sum">Всего: <b>${units.length}</b> · заняты: <b>${units.length - free}</b> · стоят: <b class="${free ? 'wk-bad' : ''}">${free}</b></div>`;
  for (const job of WK_JOBS) {
    const list = st.filter(([u]) => wkJob(u) === job);
    const busy = list.filter(([, s]) => !s.why).length, c = wkCap(job);
    h += `<div class="pr-row"><div class="pr-name"><b>${WK_JOB_NAME[job]}</b><span class="pr-n">${list.length} гн. · заняты ${busy}</span></div>
      <div class="wk-cap">На работе: <button data-wk="cap:${job}:-1" ${c === 0 ? 'disabled' : ''}>−</button><b>${c === Infinity ? 'все' : c}</b><button data-wk="cap:${job}:1" ${c === Infinity ? 'disabled' : ''}>+</button>${c === Infinity ? '' : `<button data-wk="cap:${job}:all" class="wk-all">все</button>`}</div>
      <div class="wk-list">${list.map(([u, s]) => wkRowHTML(u, s)).join('') || '<span class="pr-hint">нет</span>'}</div></div>`;
  }
  const others = st.filter(([u]) => !WK_JOBS.includes(wkJob(u)) && st.length);
  const idleOthers = others.filter(([, s]) => s.why);
  h += `<div class="pr-row"><div class="pr-name"><b>Мастера в зданиях</b><span class="pr-n">${others.length} гн. · стоят ${idleOthers.length}</span></div>
    <div class="wk-list">${idleOthers.map(([u, s]) => wkRowHTML(u, s)).join('') || '<span class="pr-hint">все при деле</span>'}</div></div>`;
  h += `<div class="pr-foot"><button data-wk="reset" ${wkAny() ? '' : 'disabled'}>Снять все назначения</button></div>`;
  return h;
}
function wkRowHTML(u, s) {
  const pin = wkPinLabel(u);
  return `<div class="wk-u${s.why ? ' idle' : ''}" data-wk="sel:${u.id}"><b>${wkName(u)}</b>${unitLevel(u) > 1 ? `<small>ур.${unitLevel(u)}</small>` : ''}<span>${s.why ? '⏸ ' + s.why : s.doing || 'занят'}</span>${pin ? `<i>📌 ${pin}</i>` : ''}</div>`;
}

// выбор здания для закрепления/маршрута
function wkOpts(cur, list, extra) {
  return extra.map(([v, n]) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${n}</option>`).join('') +
    list.map(b => `<option value="${b.id}"${cur === b.id ? ' selected' : ''}>${wkBN(b)} #${b.id}</option>`).join('');
}

// Блок «Работа»: в карточке настроения гнома (mood.js) или в своей карточке — у извозчиков и коз её нет
function wkCardBody(u) {
  const s = wkStatus(u), p = u.wk;
  let h = `<div class="wk-t">Работа · ${wkName(u)}${wkPinLabel(u) ? ' · 📌' : ''}</div>`;
  if (typeof isProf === 'function' && isProf(u)) {
    const L = unitLevel(u), M = levelMax(u.type), t = LEVEL_XP[u.type], sp = Math.round((PROF_SPEED[L] - 1) * 100);
    h += `<div class="wk-hint">Уровень ${L} из ${M}${L < M ? ` · выслуга ${u.xp || 0} из ${t[L]}` : ''}${sp ? ` · быстрее на ${sp}%` : ''}<br>${profPerkText(u.type)}</div>`;
    if (u.type === 'stonemason' && u.home && u.home.type === 'quarry') h += `<div class="wk-hint">Ходит за камнем до ${quarryReach(u, u.home)} клеток от каменоломни</div>`;
  }
  h += s.why ? `<div class="wk-st idle">Стоит: <b>${s.why}</b></div>` : `<div class="wk-st">Занят: ${s.doing || 'при деле'}</div>`;
  const cd = Math.max(0, Math.ceil((u.kickAt || -1e9) + WK_KICK_CD - Game.time));
  const kick = wkKickable(u) || (wkMirror() && s.why);
  if (kick) h += `<button class="hp-ab wk-kick" data-wk="kick:${u.id}" ${cd > 0 ? 'disabled' : ''}>👢 Пнуть${cd > 0 ? ` (${cd} с)` : ''}<small>герой даст пинок — пойдёт работать</small></button>`;
  if (wkManaged(u)) {
    const done = Game.buildings.filter(b => b.state === 'done' && !b.removed && !b.isRoad);
    if (u.type === 'builder') {
      const sites = Game.buildings.filter(b => !b.removed && !b.isRoad && (b.state !== 'done' || b.upg || b.dmg > 0.05));
      const cur = p ? (p.off ? 'off' : p.b) : '';
      if (p && p.b != null && !sites.some(b => b.id === p.b) && wkB(p.b)) sites.unshift(wkB(p.b));
      h += `<label class="wk-l">Задание<select data-wks="b:${u.id}">${wkOpts(cur, sites, [['', 'Авто (как решит игра)'], ['off', 'Отдыхать']])}</select></label><div class="wk-hint">Закрепить за стройкой: строит, достраивает и чинит только её.</div>`;
    } else {
      const off = !!(p && p.off), r = p && !p.off ? p : {};
      const ex = [['', 'любое'], ['store', 'склад']];
      h += `<label class="wk-l">Откуда<select data-wks="from:${u.id}" ${off ? 'disabled' : ''}>${wkOpts(r.from ?? '', done.filter(b => b.def.outputs || b.isStore()), ex)}</select></label>`;
      h += `<label class="wk-l">Куда<select data-wks="to:${u.id}" ${off ? 'disabled' : ''}>${wkOpts(r.to ?? '', [...done.filter(b => b.def.inputs || b.isStore()), ...Game.buildings.filter(b => b.state !== 'done' && !b.removed)], ex)}</select></label>`;
      h += `<label class="wk-chk"><input type="checkbox" data-wks="off:${u.id}" ${off ? 'checked' : ''}> Отдыхать (не брать работу)</label><div class="wk-hint">Маршрут: возит только между этими зданиями, например мельница → склад.</div>`;
    }
  } else if (u.home && !u.home.removed) h += `<div class="wk-hint">Работает в здании «${wkBN(u.home)}». Остановить — пауза в окне здания.</div>`;
  return `<div class="wk-box">${h}</div>`;
}
// показывает ли mood.js свою карточку для этого гнома (её же условие)
const wkMoodCard = u => typeof mdCardHTML === 'function' && typeof isPerson === 'function' && isPerson(u) && u.type !== 'carter' && !u.rec && !u.gx;
const wkPicking = id => { const a = document.activeElement, c = document.getElementById(id); return !!(a && c && a.tagName === 'SELECT' && c.contains(a)); };

function wkCardUpdate() {
  let card = document.getElementById('wk-card');
  if (!card) {
    card = document.createElement('div'); card.id = 'wk-card';
    (document.getElementById('view') || document.body).appendChild(card);
    card.addEventListener('click', e => { if (e.target.closest('.hc-x')) { Game.selUnit = null; updateUI(true); } });
  }
  const u = Game.selUnit;
  if (!u || u.dead || !wkSelectable(u) || wkMoodCard(u)) { card.style.display = 'none'; return; }
  if (wkPicking('wk-card')) return;     // открытый список не перерисовываем, пока выбирают
  const T = UNIT_TYPES[u.type];
  const html = `<div class="ihead"><img class="bpic" src="${portraitURL(u.type, u.look, personSex(u))}" alt=""><div><h3>${T.name}</h3>${unitLevel(u) > 1 ? `<span class="muted small">ур. ${unitLevel(u)}</span>` : ''}</div></div>` +
    wkCardBody(u) + '<button class="hc-x" title="Закрыть (Esc)">×</button>';
  if (card.dataset.h !== html) { card.dataset.h = html; card.innerHTML = html; }
  card.style.display = 'block';
}

// встраиваемся в карточку настроения: mood.js грузится позже — подключаемся при первом обновлении интерфейса
let wkMoodHooked = false;
function wkMoodHook() {
  if (wkMoodHooked || typeof mdCardHTML !== 'function' || typeof mdCardUpdate !== 'function') return;
  wkMoodHooked = true;
  const _h = mdCardHTML;
  mdCardHTML = function (u) {
    const h = _h(u);
    if (!wkSelectable(u)) return h;
    const i = h.lastIndexOf('<button class="hc-x"');
    return i < 0 ? h + wkCardBody(u) : h.slice(0, i) + wkCardBody(u) + h.slice(i);
  };
  const _cu = mdCardUpdate;
  mdCardUpdate = function () { if (!wkPicking('mood-card')) _cu(); };
}

// списки «Задание», «Откуда», «Куда» и галочка «Отдыхать» — в обеих карточках
function wkPinChange(el) {
  const [k, id] = el.dataset.wks.split(':'), u = Game.unitMap.get(+id);
  if (!u) return;
  const val = v => v === '' ? null : v === 'store' ? 'store' : +v;
  let pin;
  if (k === 'b') pin = el.value === '' ? null : el.value === 'off' ? { off: 1 } : { b: +el.value };
  else if (k === 'off') pin = el.checked ? { off: 1 } : null;
  else {
    const r = u.wk && !u.wk.off ? { from: u.wk.from ?? null, to: u.wk.to ?? null } : { from: null, to: null };
    r[k] = val(el.value);
    pin = r.from == null && r.to == null ? null : r;
  }
  el.blur();
  if (wkMirror()) u.wk = pin;   // сразу показать, сервер подтвердит следующим пакетом
  wkSend({ a: 'pin', id: u.id, p: pin });
  if (wkMirror()) updateUI(true);
}

function wkAct(k) {
  const [a, v, w] = k.split(':');
  if (a === 'sel') {
    const u = Game.unitMap.get(+v);
    if (!u) return;
    Game.selected = null; Game.selUnit = u;
    centerOn(u.x * TILE, u.y * TILE);
    if (typeof Mobile !== 'undefined' && Mobile.on && typeof mobileSheet === 'function') mobileSheet(null);
    updateUI(true); return;
  }
  if (a === 'kick') {
    const u = Game.unitMap.get(+v);
    if (wkMirror()) { coopSend({ t: 'wk', a: 'kick', id: +v }); return; }
    const e = wkKick(Game.hero, u);
    if (e) toast(e);
    updateUI(true); return;
  }
  if (a === 'reset') {
    if (!confirm('Снять все закрепления, маршруты и лимиты? Гномы вернутся на автоматику.')) return;
    wkSend({ a: 'reset' }); return;
  }
  if (a === 'cap') {
    const cur = wkCap(v), n = Game.units.filter(u => !u.dead && wkJob(u) === v).length;
    const nv = w === 'all' ? null : cur === Infinity ? Math.max(0, n - 1) : Math.max(0, cur + +w);
    wkSend({ a: 'cap', job: v, v: nv !== null && nv >= n && +w > 0 ? null : nv });
  }
}

// тап по гному на карте — карточка (не при выбранном герое: тогда тап зовёт в команду)
function wkTapUnit(t) {
  if (Game.tool || !inb(t[0], t[1]) || (Game.hero && Game.selUnit === Game.hero)) return false;
  if (typeof buildingAt === 'function' && buildingAt(t)) return false;
  const u = typeof unitAtClick === 'function' ? unitAtClick(t) : null;
  if (!wkSelectable(u)) return false;
  Game.selected = null; Game.selUnit = u;
  updateUI(true);
  return true;
}

if (typeof document !== 'undefined' && typeof navigator !== 'undefined' && navigator.userAgent !== 'node' && typeof updateUI === 'function' && document.getElementById && document.getElementById('tab-prio')) {
  const _uu = updateUI;
  updateUI = function (force) { wkMoodHook(); _uu(force); wkHook(); wkCardUpdate(); };
  document.addEventListener('click', e => {
    const el = e.target.closest('#wk-card [data-wk], #mood-card [data-wk]');
    if (el && !el.disabled) wkAct(el.dataset.wk);
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('#wk-card [data-wks], #mood-card [data-wks]');
    if (el) wkPinChange(el);
  });
  const _click = onLeftClickTile;
  onLeftClickTile = function (t) { if (wkTapUnit(t)) return; _click(t); };
  const sec = document.getElementById('prio-list');
  if (sec) sec.addEventListener('click', e => {
    const v = e.target.closest('[data-prv]');
    if (v) { UI.prioView = v.dataset.prv; updateUI(true); return; }
    const el = e.target.closest('[data-wk]');
    if (el && !el.disabled) wkAct(el.dataset.wk);
  });
}
