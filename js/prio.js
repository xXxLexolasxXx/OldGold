'use strict';
// Срочность работ и пауза с планированием.
// Ручных приоритетов (Выкл/Низкий/Авто/Высокий по задачам и профессиям) больше нет: они были костылём и чаще ломали
// хозяйство, чем чинили. Порядок решает игра (logistics.js), а игроку остаётся кнопка «Срочно» в окне здания:
// 20 секунд все свободные гномы этой дорожной сети носят в здание и из него, а его отрасль (поставщики сырья,
// получатели продукции, такие же здания) идёт следом. Без перезарядки: нажали ещё раз — снова 20 секунд.
// Голод (трактир на исходе) и золото для школы всё равно идут первыми — «Срочно» деревню не заморит.
// Авто-срочность без игрока: еды мало — пищевая цепочка раньше, дров на зиму мало — лесорубы, вечер и ночь — оборона.
// Читают: logistics.js (urgLv, autoUrg), ui.js (кнопка), render.js (значок «!»), coopsim.js (bact urgent), save.js (поле urg).
// Старое поле pr в сохранениях (уровни приоритетов) просто не читается.

const URG_SEC = 20;
const urgOn = b => !!b && !b.removed && Game.time < (b.urgUntil || 0);
const urgLeft = b => Math.max(0, Math.ceil((b.urgUntil || 0) - Game.time));
// у чего есть смысл торопить: стройка, достройка, ремонт, мастерская, добыча; склад и дом без работы — нет
function urgCan(b) {
  if (!b || b.removed || b.isRoad || b.isPile || !b.def) return false;
  if (b.state !== 'done' || b.upg || b.dmg > 0.05) return true;
  if (b.isStore()) return false;
  return !!(b.def.inputs || b.def.outputs || b.def.worker);
}
function urgPress(b) {
  if (!urgCan(b)) return false;
  b.urgUntil = Game.time + URG_SEC;
  urgT = -1;
  return true;
}

// Отрасль срочных зданий: само здание — 2, связанные — 1. Пересчёт не чаще раза в полсекунды.
let urgT = -1, urgMap = null;
function urgBranch() {
  if (urgMap && Math.abs(Game.time - urgT) < 0.5) return urgMap;
  urgT = Game.time; urgMap = new Map();
  const hot = Game.buildings.filter(urgOn);
  if (!hot.length) return urgMap;
  for (const b of hot) {
    urgMap.set(b, 2);
    // что зданию нужно (сырьё или материал стройки) и что оно делает
    const need = new Set(Object.keys(b.state !== 'done' || b.upg ? b.def.cost || {} : b.def.inputs || {}));
    const make = new Set(b.state === 'done' ? Object.keys(b.def.outputs || {}) : []);
    for (const o of Game.buildings) {
      if (o === b || o.removed || urgMap.get(o) === 2 || o.state !== 'done' || o.isStore()) continue;
      const outs = o.def.outputs || {}, ins = o.def.inputs || {};
      if (o.type === b.type || Object.keys(outs).some(g => need.has(g)) || Object.keys(ins).some(g => make.has(g))) urgMap.set(o, 1);
    }
  }
  return urgMap;
}
const urgLv = d => (!d || d.isPile || d.isRoad) ? 0 : (urgBranch().get(d) || 0);

// Авто-срочность (0…1): чем деревня рискует прямо сейчас. Только переставляет внутри своей очереди — голодный трактир,
// школа без золота и стройки по-прежнему идут по своим местам (logistics.js reqPri).
let urgAutoT = -1, urgAutoC = null;
function urgAutoNow() {
  if (urgAutoC && Math.abs(Game.time - urgAutoT) < 2) return urgAutoC;
  let food = 0, ppl = 0;
  for (const x of Game.buildings) if (x.state === 'done' && !x.removed && (x.type === 'inn' || x.isStore())) for (const g of FOODS) food += x.stock[g] || 0;
  for (const u of Game.units) if (!u.dead && !u.noFood && isPerson(u)) ppl++;
  urgAutoT = Game.time;
  urgAutoC = {
    food: ppl > 0 && food < Math.max(10, ppl * 2),          // меньше двух обедов на жителя
    wood: typeof seaWoodRush === 'function' && seaWoodRush(),
    night: typeof isEveningNow === 'function' && (isEveningNow() || isNightNow()),
  };
  return urgAutoC;
}
const URG_FOOD = new Set(['farm', 'mill', 'bakery', 'swine', 'butchery', 'inn']);
const URG_WOOD = new Set(['woodcutter', 'sawmill']);
const URG_DEF = new Set(['smeltery', 'weaponsmith', 'armory']);
function autoUrg(d) {
  if (!d || d.isPile || d.isRoad || !d.def) return 0;
  const a = urgAutoNow();
  if (a.food && URG_FOOD.has(d.type)) return 0.6;
  if (a.wood && URG_WOOD.has(d.type)) return 0.5;
  if (a.night && (d.def.cat === 'Оборона' || URG_DEF.has(d.type))) return 0.4;
  return 0;
}

// Профессии, которые показывает вкладка «Рабочие» (workers.js): кто выходит из школы и работает в зданиях,
// плюс работяга и перевозчики; у козы и извозчика общая строка
const PRIO_CARRY = { goat: 'carter' };
const prioJobKey = u => PRIO_CARRY[u.type || u] || (u.type || u);
let _prioJobs = null;
function prioJobList() {
  if (_prioJobs) return _prioJobs;
  const set = new Set(['builder', 'serf', 'carter']);
  for (const k in BUILDINGS) if (BUILDINGS[k].worker) set.add(BUILDINGS[k].worker);
  return (_prioJobs = ALL_UNIT_KEYS.filter(k => set.has(k)));
}

// ---------- Скорость и пауза ----------
const SPEEDS = [1, 2, 3];
const speedLabel = s => '×' + String(s).replace('.', ',');
// в коопе время решает сервер: Coop.tempo = { speed, paused, votes, need }
function tempoNow() { return Game.coop && typeof Coop !== 'undefined' && Coop.tempo ? Coop.tempo : { speed: Game.speed, paused: Game.paused }; }
function togglePause() {
  if (Game.coop) { coopSend({ t: 'pause', on: !tempoNow().paused }); return; }
  setSpeed(Game.paused ? Game.speed : 0);
}
function pickSpeed(i) {
  const s = SPEEDS[i];
  if (!s) return;
  if (Game.coop) {
    if (typeof Coop !== 'undefined' && !Coop.host) { toast('Скорость выбирает хост'); return; }
    coopSend({ t: 'speed', v: s }); return;
  }
  setSpeed(s);
  toast('Скорость ' + speedLabel(s));
}
function tempoShow() {
  const t = tempoNow();
  document.querySelectorAll('[data-speed]').forEach(b =>
    b.classList.toggle('active', t.paused ? b.dataset.speed === '0' : +b.dataset.speed === t.speed));
  const cur = document.getElementById('speed-cur');
  if (cur) cur.textContent = t.paused ? '❚❚' : speedLabel(t.speed);
  const bn = document.getElementById('pause-banner');
  if (bn) {
    bn.classList.toggle('hidden', !t.paused);
    if (t.paused) {
      const v = Game.coop && t.votes ? ` Голосов за паузу: ${t.votes}/${t.need}.` : '';
      bn.innerHTML = `<b>Пауза</b> — можно ставить дороги, здания, поля и сносить. <kbd>Пробел</kbd> — продолжить.${v}`;
    }
  }
}

if (typeof document !== 'undefined' && typeof navigator !== 'undefined' && navigator.userAgent !== 'node' && typeof updateUI === 'function' && document.getElementById && document.getElementById('tab-prio')) {
  // вкладка «Рабочие» (бывшие «Приоритеты»: id вкладки прежний, на него смотрят обучение и открытие по этапам)
  const _uu = updateUI;
  updateUI = function (force) {
    _uu(force);
    if (UI.tab === 'prio' && typeof wkListHTML === 'function') setHTML('prio-list', wkListHTML());
    tempoShow();
  };
  if (typeof ICON_GRIDS !== 'undefined') {
    // значок вкладки: гном в колпаке (раньше — стрелки вверх и вниз)
    ICON_GRIDS.ui.prio = { pal: { o: '#2a1e10', r: '#c8302a', R: '#7a1a14', s: '#e8bc94', w: '#e4e0d6', W: '#9a948a', b: '#4a6e30' }, rows: [
      '.......oo.......',
      '......orRo......',
      '......orRo......',
      '.....orrRRo.....',
      '.....orrRRo.....',
      '....orrrrRRo....',
      '...oooooooooo...',
      '....ossssssso...',
      '....osossosso...',
      '....ossssssso...',
      '...owwwwwwwwwo..',
      '...owwwWwwWwwo..',
      '...obwwwwwwwbo..',
      '..obbbwwwwwbbbo.',
      '..obbbbwwwbbbbo.',
      '..ooooooooooooo.'] };
  }
  { const b = document.createElement('div'); b.id = 'pause-banner'; b.className = 'hidden'; (document.getElementById('view') || document.body).appendChild(b); }
}
