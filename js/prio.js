'use strict';
// Приоритеты работ: вкладка «Приоритеты» (как в RimWorld, но проще) и пауза с планированием.
// Уровни: 0 «Выкл» — не занимаются совсем, 1 «Низкий» — в последнюю очередь, 2 «Авто» — как решает игра (прежнее поведение),
// 3 «Высокий» — в первую очередь. В Game.prio.jobs (профессии) и Game.prio.tasks (задачи) лежит только то, что не «Авто».
// Читают: logistics.js (кому везти и кого куда ставить), jobs.js и entities.js (здание «выключено» = на паузе),
// coopsim.js (команда prio), save.js (поле pr в сохранении).

const PRIO_NAMES = ['Выкл', 'Низкий', 'Авто', 'Высокий'];
const PRIO_AUTO = 2;
const PRIO_TASKS = {
  food:    { name: 'Еда', icon: ['good', 'bread'], types: ['farm', 'mill', 'bakery', 'swine', 'butchery', 'inn'], safe: ['inn'],
    hint: 'Фермы, мельница, пекарня, свинарник, бойня и подвоз еды в трактир. Без еды гномы голодают и падают — выключайте, только если еды вдоволь.' },
  build:   { name: 'Стройка', icon: ['ui', 'build'], types: [],
    hint: 'Новые здания, дороги и достройка. «Высокий» — стройки получают материалы и работяг раньше хозяйства; «Выкл» — стройка встаёт (ремонт идёт).' },
  wood:    { name: 'Дрова', icon: ['good', 'timber'], types: ['woodcutter', 'sawmill'],
    hint: 'Дом лесоруба и лесопилка: брёвна и доски. «Выкл» — рубка и распил стоят, пока не включите.' },
  haul:    { name: 'Перенос ресурсов', icon: ['good', 'trunk'], types: [],
    hint: 'Вывоз готовой продукции из мастерских и рассыпанного с земли на склад. «Высокий» — кучи с земли свозят в первую очередь и больше курьеров на здание; «Низкий» — по одному; «Выкл» — не свозят (кроме еды).' },
  defense: { name: 'Оборона', icon: ['good', 'sword'], types: ['smeltery', 'weaponsmith', 'armory'],
    hint: 'Плавильня металла, оружейная и мастерская доспехов — снаряжение для героя и бойцов. Нужнее перед ночами.' },
};
const PRIO_OF = {};
for (const k in PRIO_TASKS) for (const t of PRIO_TASKS[k].types) PRIO_OF[t] = k;
const PRIO_SAFE = new Set(Object.values(PRIO_TASKS).flatMap(t => t.safe || []));
// перевозчики: у козы и извозчика общая строка
const PRIO_CARRY = { goat: 'carter' };
const prioJobKey = u => PRIO_CARRY[u.type || u] || (u.type || u);

function prioState() { return Game.prio || (Game.prio = { jobs: {}, tasks: {} }); }
function prioLv(kind, key) { const p = Game.prio; const v = p && p[kind] && p[kind][key]; return v === undefined ? PRIO_AUTO : v; }
const prioJobLv = u => prioLv('jobs', prioJobKey(u));

// Какая задача и какая профессия стоят за зданием, стройкой, дорогой
function prioTaskOf(d) {
  if (!d || d.isPile) return null;
  if (d.isRoad || d.state !== 'done' || d.upg) return 'build';
  return PRIO_OF[d.type] || null;
}
function prioJobOf(d) {
  if (!d || d.isPile) return null;
  if (d.isRoad || d.state !== 'done' || d.upg) return 'builder';
  return (d.def && d.def.worker) || null;
}
// Готовое здание «выключено» приоритетами: не работает, как будто на паузе
function prioOff(b) {
  if (!Game.prio || !b || b.state !== 'done' || !b.def) return false;
  if (b.def.worker && prioLv('jobs', b.def.worker) === 0) return true;
  const t = PRIO_OF[b.type];
  return !!t && !PRIO_SAFE.has(b.type) && prioLv('tasks', t) === 0;
}
// Не возить: адресат (здание, стройка, дорога) выключен
function prioBlocked(d) {
  const t = prioTaskOf(d), j = prioJobOf(d);
  if (t && prioLv('tasks', t) === 0 && !(d.type && PRIO_SAFE.has(d.type) && d.state === 'done')) return true;
  return !!(j && prioLv('jobs', j) === 0);
}
// Насколько адресат важнее обычного: от −2 (оба «Низкий») до +2 (оба «Высокий»)
function prioScore(d) {
  const t = prioTaskOf(d), j = prioJobOf(d);
  return (t ? prioLv('tasks', t) - PRIO_AUTO : 0) + (j ? prioLv('jobs', j) - PRIO_AUTO : 0);
}
function prioAny() { const p = Game.prio; return !!p && (Object.keys(p.jobs).length + Object.keys(p.tasks).length) > 0; }

function prioSet(kind, key, v) {
  if (kind !== 'jobs' && kind !== 'tasks') return false;
  if (kind === 'tasks' ? !Object.prototype.hasOwnProperty.call(PRIO_TASKS, key) : !prioJobList().includes(key)) return false;
  if (!Number.isInteger(v) || v < 0 || v > 3) return false;
  const p = prioState();
  if (v === PRIO_AUTO) delete p[kind][key]; else p[kind][key] = v;
  return true;
}
function prioReset() { Game.prio = { jobs: {}, tasks: {} }; }

// Профессии: кто выходит из школы и работает в зданиях, плюс работяга и перевозчики
let _prioJobs = null;
function prioJobList() {
  if (_prioJobs) return _prioJobs;
  const set = new Set(['builder', 'serf', 'carter']);
  for (const k in BUILDINGS) if (BUILDINGS[k].worker) set.add(BUILDINGS[k].worker);
  return (_prioJobs = ALL_UNIT_KEYS.filter(k => set.has(k)));
}
const PRIO_JOB_NAME = { carter: 'Извозчики и козы', serf: 'Трудяги (носят грузы)', builder: 'Работяги (стройка)' };
const PRIO_JOB_HINT = {
  serf: 'Развозят грузы. «Выкл» — доставки встанут совсем, будьте осторожны.',
  carter: 'Телеги и вьючные козы: возят большие партии. «Высокий» — их берут первыми.',
  builder: 'Строят, чинят и вскапывают поля. «Выкл» — стройка и ремонт встают.',
};

// ---------- Обёртки сохранения и сброса ----------
{
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.prio = { jobs: {}, tasks: {} }; };
  const _sg = serializeGame;
  serializeGame = function () { const s = _sg(); if (prioAny()) s.pr = { jobs: Game.prio.jobs, tasks: Game.prio.tasks }; return s; };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    Game.prio = { jobs: {}, tasks: {} };
    const pr = s.pr;
    if (pr) {
      for (const k in pr.jobs || {}) if (prioJobList().includes(k)) prioSet('jobs', k, pr.jobs[k]);
      for (const k in pr.tasks || {}) prioSet('tasks', k, pr.tasks[k]);
    }
  };
}

// ---------- Вкладка «Приоритеты» ----------
function prioWarnings() {
  const out = [];
  const lv = (k, key) => prioLv(k, key);
  if (lv('tasks', 'food') === 0) out.push('Еда выключена: фермы и цеха стоят, гномы скоро проголодаются.' + (Game.diff === 'survival' ? ' В «Выживании» голод быстро заканчивается потерями.' : ''));
  if (lv('jobs', 'serf') === 0) out.push('Трудяги выключены: грузы никто не возит, встанет всё хозяйство.');
  if (lv('jobs', 'builder') === 0 || lv('tasks', 'build') === 0) out.push('Стройка выключена: новые здания и дороги не строятся.');
  if (lv('tasks', 'haul') === 0) out.push('Перенос ресурсов выключен: продукция копится в мастерских, и они встают.');
  return out;
}

function prioSeg(kind, key, cur) {
  return '<div class="pr-seg">' + PRIO_NAMES.map((n, i) =>
    `<button data-pr="${kind}:${key}:${i}" class="pr-${i}${cur === i ? ' on' : ''}" title="${i === 0 ? 'Выключить: не занимаются совсем' : i === 1 ? 'Низкий: в последнюю очередь' : i === 2 ? 'Авто: как решает игра (по умолчанию)' : 'Высокий: в первую очередь'}">${n}</button>`).join('') + '</div>';
}

function prioHTML() {
  const wk = typeof wkListHTML === 'function';
  const tabs = wk ? `<div class="pr-views"><button data-prv="prio" class="${UI.prioView !== 'wk' ? 'on' : ''}">Приоритеты</button><button data-prv="wk" class="${UI.prioView === 'wk' ? 'on' : ''}">Рабочие</button></div>` : '';
  if (wk && UI.prioView === 'wk') return tabs + wkListHTML();
  let h = tabs + `<div class="pr-intro">Кто чем займётся в первую очередь. <b>Авто</b> — как решает игра, трогать не обязательно. <b>Высокий</b> — делают первым, <b>Низкий</b> — последним, <b>Выкл</b> — не делают совсем.</div>`;
  const warn = prioWarnings();
  if (warn.length) h += `<div class="pr-warn">${warn.map(w => '⚠ ' + w).join('<br>')}</div>`;
  h += '<h4 class="pr-h">Задачи</h4>';
  for (const k in PRIO_TASKS) {
    const t = PRIO_TASKS[k];
    const n = k === 'build' ? Game.buildings.filter(b => b.state !== 'done').length + Game.roadSites.size : k === 'haul' ? Game.piles.size : Game.buildings.filter(b => b.state === 'done' && PRIO_OF[b.type] === k).length;
    h += `<div class="pr-row"><div class="pr-name"><img src="${iconURL(t.icon[0], t.icon[1], 2)}" alt=""><b>${t.name}</b><span class="pr-n">${k === 'build' ? n + ' строек' : k === 'haul' ? n + ' куч' : n + ' зд.'}</span></div>${prioSeg('tasks', k, prioLv('tasks', k))}<div class="pr-hint">${t.hint}</div></div>`;
  }
  h += '<h4 class="pr-h">Профессии</h4>';
  for (const k of prioJobList()) {
    const n = Game.units.filter(u => !u.dead && prioJobKey(u) === k).length;
    h += `<div class="pr-row pr-job"><div class="pr-name"><b>${PRIO_JOB_NAME[k] || UNIT_TYPES[k].name}</b><span class="pr-n">${n} гн.</span></div>${prioSeg('jobs', k, prioLv('jobs', k))}${PRIO_JOB_HINT[k] ? `<div class="pr-hint">${PRIO_JOB_HINT[k]}</div>` : ''}</div>`;
  }
  h += `<div class="pr-foot"><button data-pr="reset" ${prioAny() ? '' : 'disabled'}>Всё на «Авто»</button><span>Пауза — <kbd>Пробел</kbd>, скорость — <kbd>Shift+1…3</kbd>. На паузе можно ставить дороги, здания, поля и сносить.</span></div>`;
  return h;
}

function prioClick(e) {
  const b = e.target.closest('[data-pr]');
  if (!b || b.disabled) return;
  if (b.dataset.pr === 'reset') {
    if (Game.coop) { coopSend({ t: 'prio', reset: true }); return; }
    prioReset(); updateUI(true); return;
  }
  const [kind, key, v] = b.dataset.pr.split(':');
  if (Game.coop) { coopSend({ t: 'prio', k: kind, key, v: +v }); return; }
  prioSet(kind, key, +v);
  updateUI(true);
}

// Сервер: команда игрока (права «manage») и снимок для рассылки
function prioCmd(m) {
  if (m.reset) prioReset(); else prioSet(m.k, m.key, m.v);
  return { t: 'prio', p: { jobs: Game.prio.jobs, tasks: Game.prio.tasks } };
}
function prioApply(p) {
  Game.prio = { jobs: {}, tasks: {} };
  for (const k in (p && p.jobs) || {}) prioSet('jobs', k, p.jobs[k]);
  for (const k in (p && p.tasks) || {}) prioSet('tasks', k, p.tasks[k]);
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
  const _uu = updateUI;
  updateUI = function (force) {
    _uu(force);
    if (UI.tab === 'prio') setHTML('prio-list', prioHTML());
    const bd = document.getElementById('prio-badge');
    if (bd) bd.classList.toggle('hidden', !prioAny());
    tempoShow();
  };
  const sec = document.getElementById('prio-list');
  if (sec) sec.addEventListener('click', prioClick);
  if (typeof ICON_GRIDS !== 'undefined') {
    ICON_GRIDS.ui.prio = { pal: { o: '#2a1e10', g: '#e4b434', G: '#a06a14', w: '#d8d4c8', s: '#8a857c', r: '#c8503a' }, rows: [
      '................',
      '.oooooooooooooo.',
      '.owwwwwwwwwwwwo.',
      '.ow.gg..ssssswo.',
      '.owwwwwwwwwwwwo.',
      '.ow.g.gg.sssswo.',
      '.owwwwwwwwwwwwo.',
      '.ow.gg..ssswwwo.',
      '.owwwwwwwwwwwwo.',
      '.orr.gg.ssssswo.',
      '.owwwwwwwwwwwwo.',
      '.ow.g...ssswwwo.',
      '.owwwwwwwwwwwwo.',
      '.oooooooooooooo.',
      '................',
      '................'] };
  }
  { const b = document.createElement('div'); b.id = 'pause-banner'; b.className = 'hidden'; (document.getElementById('view') || document.body).appendChild(b); }
}
