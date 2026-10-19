'use strict';
// Летопись деревни: автоматический дневник на пергаменте. Слушает журнал событий (logEvent) и гибель жителей
// (removeUnit), отбирает важное и пишет короткие записи с сарказмом: «В 12-ю ночь погиб Борин, лесоруб…».
// Состояние — Game.chron = { e: [{ d, k, s, i }], seen: {…}, name } — пишется в сохранение (s.chron).
// Записи не пересекаются с журналом: журнал — сырой поток на час, летопись — отобранная история на всю игру.
// Всё детерминировано (никакого Math.random): записи зависят только от номера суток и числа записей, поэтому
// одинаковый сид даёт одинаковую летопись. Кооп: пишет только сервер, клиентам уходит {t:'chron', e}.
// Экран «Летопись» — кнопка в меню или клавиша L; название деревни берётся из сида и переименовывается.

const CHRON_MAX = 360;          // записей в памяти
const CHRON_DAY_CAP = 5;        // обычных записей за сутки (важные — не считаются)
const CHRON_NAMES = ['Борин', 'Двалин', 'Торин', 'Балин', 'Глоин', 'Нори', 'Дори', 'Ори', 'Бифур', 'Бофур', 'Бомбур', 'Фундин', 'Грор', 'Нар', 'Тарн',
  'Брунд', 'Хельги', 'Гимли', 'Дурин', 'Траин', 'Тельдар', 'Мотсогнир', 'Грундик', 'Кварк', 'Булат', 'Горм', 'Рагнар', 'Скальд', 'Хродгар', 'Зигрид',
  'Бальдур', 'Огрим', 'Тарбен', 'Мурин', 'Брокк', 'Эйтри', 'Виг', 'Свирфа', 'Ломас', 'Дубин', 'Кремень', 'Пудов', 'Жилин', 'Бородач', 'Гранит', 'Угрюм', 'Сивоус'];
const CHRON_P1 = ['Лесная', 'Каменная', 'Медовая', 'Хмельная', 'Тихая', 'Угольная', 'Пивная', 'Серая', 'Дубовая', 'Тёплая', 'Кривая', 'Ржаная', 'Брусничная', 'Мшистая'];
const CHRON_P2 = ['Заимка', 'Пядь', 'Горка', 'Падь', 'Копь', 'Долина', 'Слобода', 'Балка', 'Ложбина', 'Печура', 'Гряда', 'Берлога', 'Лощина', 'Околица'];

const chronMirror = () => typeof isMirror === 'function' && isMirror();
const chronPick = (arr, k) => arr[Math.abs(k | 0) % arr.length];

function chronState() {
  return Game.chron || (Game.chron = { e: [], seen: {}, name: '', dayN: -1, dayC: 0, lost: 0, last: -99 });
}

// Название деревни: из сида карты, если игрок не задал своё
function villageName() {
  const C = Game.chron;
  if (C && C.name) return C.name;
  const s = (Number(Game.seed) || 0) >>> 0;
  return chronPick(CHRON_P1, s) + ' ' + chronPick(CHRON_P2, (s >>> 4) + 3 * (s % 7));
}
function villageRename(name) {
  const n = String(name || '').replace(/[<>&"]/g, '').trim().slice(0, 28);
  chronState().name = n;
  return villageName();
}

// Номер суток (с 1) и «ночь это или день»
function chronDay() { return cycleAt(Game.time).k + 1; }
function chronOrd(n, night) {
  // «в 12-ю ночь», «в 3-й день»: окончание по роду
  return night ? `${n}-ю ночь` : `${n}-й день`;
}
function chronWhen() { const n = isNightNow() || isEveningNow(); return 'В ' + chronOrd(chronDay(), n); }

function chronName(u) {
  if (u.hero && u.hero.name) return u.hero.name;
  if (u.gmName) return u.gmName;
  return u.cname || (u.cname = chronPick(CHRON_NAMES, (u.id | 0) * 7 + (u.look | 0)));
}

// ---------- Запись ----------

// i: 2 — веха (не режется лимитом и не затирается), 1 — заметная, 0 — обычная
function chronAdd(kind, text, imp = 0) {
  if (chronMirror() || !text) return;
  const C = chronState(), d = chronDay();
  if (C.dayN !== d) { C.dayN = d; C.dayC = 0; }
  if (imp < 2 && C.dayC >= CHRON_DAY_CAP + imp * 2) return;
  if (imp < 2) C.dayC++;
  const ent = { d, k: kind, s: text, i: imp || undefined, n: isNightNow() || isEveningNow() ? 1 : undefined };
  C.e.push(ent);
  if (C.e.length > CHRON_MAX) {
    const k = C.e.findIndex(x => !x.i);   // сначала выкидываем обычные, вехи живут дольше
    C.e.splice(k >= 0 ? k : 0, 1);
  }
  Game.chronNew = (Game.chronNew || 0) + 1;
  if (typeof coop !== 'undefined' && coop.out && coop.out.length < 200) coop.out.push({ msg: { t: 'chron', e: ent } });
  if (typeof updateUI === 'function' && Game.chronOpen) chronRefresh();
}

function chronSeen(key) { const C = chronState(); if (C.seen[key]) return true; C.seen[key] = 1; return false; }

// ---------- Фразы ----------
const CHRON_CODA = {
  death: ['Деревня постояла минуту молча — дольше бы не вышло, работы много.', 'Совет старейшин выразил соболезнования и тут же занялся пивом.', 'Дело замяли, табличку заказали.', 'Склад соболезнует: на похороны пошла лишняя доска.', 'Пережить это будет легко — хлеба стало на порцию больше.', 'Говорят, он был не промах. Не промахивался только мимо кочки.'],
  build: ['Комиссия приняла без замечаний — комиссии нет.', 'Дорогу к нему, как всегда, проложат потом.', 'Честно говоря, красиво. Честно говоря, и криво.', 'Строили всем миром, а вышло как всегда.', 'Крышу пока не обещали, но стены — это уже что-то.'],
  hunger: ['Трактир всё ещё считает, что это нормально.', 'Хлеб существует, просто не там, где нужно.', 'Диета, говорят, полезная. Но не до обморока.'],
  beer: ['Хмельной уснул, а утро укусило всех равномерно.', 'Закуски не хватило, чести — тем более.'],
  night: ['Тьма пришла без приглашения, как обычно.', 'Спали все, кроме тех, кому не повезло.', 'Утро застало деревню слегка потрёпанной, но упрямой.'],
  fight: ['Трофеи скромные, рассказов будет на год.', 'Зверь был недоволен, гном — тоже, но уже издалека.', 'Подвиг записан. Раны не записаны, их и так видно.'],
  hero: ['Хвастаться пока рано, но он уже начал.', 'Теперь он умеет ещё больше, а жаловаться — как раньше.'],
};
const coda = (k, salt) => chronPick(CHRON_CODA[k], chronDay() * 3 + chronState().e.length + (salt | 0));

// ---------- Разбор журнала ----------

function chronFromLog(kind, text) {
  let m;
  if ((m = /^Построено: (.+)$/.exec(text))) {
    const name = m[1];
    const first = !chronSeen('b:' + name);
    if (first) chronAdd('build', `${chronWhen()} заложено: ${name}. ${coda('build')}`, 1);
    return;
  }
  if ((m = /^Глава (\d+) пройдена: «(.+)»$/.exec(text))) { chronAdd('goal', `${chronWhen()} закрыта глава ${m[1]} — «${m[2]}». Старейшины кивнули, а это случается нечасто.`, 2); return; }
  if ((m = /^Поселение выросло: «(.+)»$/.exec(text))) { chronAdd('goal', `Деревня выросла до звания «${m[1]}». Герб пока нарисуем на заборе.`, 2); return; }
  if (/^ПОБЕДА/.test(text)) { chronAdd('goal', `${chronWhen()} деревня победила. ${text.replace(/^ПОБЕДА:?\s*/, '')} Летописец просит прибавки.`, 2); return; }
  if (/^ПОРАЖЕНИЕ/.test(text)) { chronAdd('goal', `${chronWhen()} деревня потерпела поражение. ${text.replace(/^ПОРАЖЕНИЕ:?\s*/, '')} Летопись продолжится, если найдётся летописец.`, 2); return; }
  if (/достроено до уровня 2/.test(text)) { chronAdd('build', `${chronWhen()} ${text.replace(/^«|»/g, '').replace(/ достроено до уровня 2/, '')} стал просторнее. Теперь есть чем гордиться и что подметать.`, 1); return; }
  if ((m = /^(.+) достиг уровня (\d+)$/.exec(text))) {
    const lvl = +m[2], hero = Game.units.some(u => u.hero && u.hero.name === m[1]);
    if (hero && lvl % 2 === 0 || lvl % 5 === 0) chronAdd('hero', `${chronWhen()} ${m[1]} достиг уровня ${lvl}. ${coda('hero')}`, hero ? 1 : 0);
    return;
  }
  if (kind === 'tree' && / одолел /.test(text)) { chronAdd('fight', `${chronWhen()}: ${text}. ${coda('fight')}`, 1); return; }
  if (/упал от голода/.test(text)) { if (!chronSeen('hunger:' + chronDay())) chronAdd('food', `${chronWhen()} ${text.replace('упал от голода', 'упал от голода посреди работы')}. ${coda('hunger')}`); return; }
  if (/перебрал пива/.test(text)) { if (!chronSeen('beer:' + chronDay())) chronAdd('people', `${chronWhen()} ${text.toLowerCase().replace(/^./, c => c.toUpperCase())} прямо на дороге. ${coda('beer')}`); return; }
  if (kind === 'animal' && /(медведя|медведь)/i.test(text) && !chronSeen('bear:' + chronDay())) { chronAdd('animal', `${chronWhen()}: ${text}. Лес снова напомнил, кто здесь хозяин.`, 1); return; }
  if (/Нечисть/.test(text) && !chronSeen('evil:' + chronDay())) { chronAdd('night', `${chronWhen()}: ${text}. Сторожа выпили для храбрости, возражений не последовало.`, 1); return; }
  if (kind === 'night' && /призрак/.test(text) && !chronSeen('ghost:' + chronDay())) { chronAdd('night', `${chronWhen()}: ${text}. ${coda('night')}`); return; }
  if (kind === 'goal' && !/Глава|Поселение|ПОБЕДА|ПОРАЖЕНИЕ/.test(text)) chronAdd('goal', `${chronWhen()}: ${text}.`);
}

// ---------- Гибель ----------
// removeUnit зовут и при гибели, и когда житель просто уходит (тогда счётчик потерь возвращают назад).
// Поэтому запись откладываем до следующего шага: если потери выросли — это гибель.

let chronCause = null;   // последнее «убийственное» сообщение журнала: { t, text }

function chronCauseText(text) {
  if (!text) return '';
  let m;
  if (/Скелет утащил/.test(text)) return 'Его утащил скелет — вежливо и без пересадок.';
  if ((m = /^(.+) утащил(?:о|а)? в туман/.exec(text))) return `Его утащило в туман: ${m[1].toLowerCase()} не любит свидетелей.`;
  if (/Куры отомстили/.test(text)) return 'Погиб от рук кур. Куры не раскаиваются.';
  if (/защищая/.test(text)) return 'Погиб, защищая питомца. Питомец, надо думать, растроган.';
  return '';
}

function chronOnRemove(u) {
  if (chronMirror() || !isPerson(u) || u.type === 'carter') return;
  const hasCause = chronCause && Math.abs(Game.time - chronCause.t) < 1.5;
  const cz = hasCause ? chronCause.text : '';
  chronCause = null;                                  // причина тратится на одного
  Game.chronPend = (Game.chronPend || []).concat([{ name: chronName(u), role: UNIT_TYPES[u.type].name.toLowerCase(), hero: !!u.hero, lost: Game.lostGnomes || 0, t: Game.time,
    night: isNightNow() || isEveningNow(), starve: u.food <= 0 && !u.noFood, cause: cz, day: chronDay() }]);
}

function chronFlushDeaths() {
  const P = Game.chronPend;
  if (!P || !P.length) return;
  Game.chronPend = null;
  const C = chronState();
  for (const p of P) {
    const died = (Game.lostGnomes || 0) > p.lost || p.cause || p.hero;
    if (!died) continue;
    C.lost = (C.lost || 0) + 1;
    const when = 'В ' + chronOrd(p.day, p.night);
    const why = chronCauseText(p.cause) || (p.starve ? 'Умер от голода — амбар, говорят, был рядом, но не с той стороны.' : '');
    const verb = p.hero ? 'пал герой' : 'погиб';
    chronAdd('death', `${when} ${verb} ${p.name}${p.hero ? '' : ', ' + p.role}. ${why ? why + ' ' : ''}${coda('death', p.name.length)}`, 1);
  }
}

// Рассвет: итоги ночи
function chronTick() {
  const C = chronState();
  if (!C.e.length && Game.time < 12 && !chronSeen('intro'))
    chronAdd('start', `Основана деревня «${villageName()}». Жителей пока горстка, мечтаний — на целый город. Летописец сидит на бочке и пишет.`, 2);
  if (Game.chronPend) chronFlushDeaths();
  const dawn = typeof isDawnNow === 'function' && isDawnNow();
  const ni = nightIndex();
  if (dawn && ni >= 0 && C.lastDawn !== ni) {
    C.lastDawn = ni;
    if (ni >= 1) {
      const lost = C.lost - (C.lostAtEve || 0);
      const txt = lost > 0
        ? `Ночь ${ni + 1}-я позади. Потери: ${lost}. Утро выдалось тихим — по необходимости.`
        : `Ночь ${ni + 1}-я позади без потерь. Старейшины в шоке и готовят отчёт, как они это сделали.`;
      if (!chronSeen('dawn:' + ni)) chronAdd('night', txt, lost > 0 ? 1 : 0);
    }
  }
  if (isEveningNow() && !isDawnNow() && C.eveN !== ni) { C.eveN = ni; C.lostAtEve = C.lost; }
}

// ---------- Экран ----------

function chronHTML() {
  const C = chronState(), list = C.e;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let h = `<div class="ch-title">Летопись деревни<br><b>«${esc(villageName())}»</b> <button id="ch-ren" class="ch-mini" title="Переименовать деревню">✎</button></div>`;
  if (!list.length) return h + '<div class="ch-empty">Страницы пока чисты. Летописец ждёт, когда в деревне хоть что-нибудь случится.</div>';
  let day = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e.d !== day) { day = e.d; h += `<div class="ch-day">Сутки ${day}</div>`; }
    h += `<p class="ch-e${e.i === 2 ? ' ch-big' : ''}${e.k === 'death' ? ' ch-dead' : ''}">${esc(e.s)}</p>`;
  }
  return h;
}

function chronText() {
  const C = chronState();
  return `Летопись деревни «${villageName()}»\n\n` + C.e.map(e => `[сутки ${e.d}] ${e.s}`).join('\n');
}

function chronRefresh() {
  const box = document.getElementById('ch-body');
  if (box) box.innerHTML = chronHTML();
}

function chronOpen() {
  let el = document.getElementById('chron');
  if (!el) {
    el = document.createElement('div');
    el.id = 'chron';
    el.className = 'hidden';
    el.innerHTML = `<div class="ch-box"><div class="ch-head"><button id="ch-copy" title="Скопировать текст летописи / поделиться">Поделиться</button><button id="ch-x" title="Закрыть (Esc)">✕</button></div><div id="ch-body"></div></div>`;
    (document.getElementById('view') || document.body).appendChild(el);
    el.addEventListener('click', e => {
      if (e.target === el || e.target.id === 'ch-x') chronClose();
      else if (e.target.id === 'ch-ren') {
        const n = prompt('Название деревни:', villageName());
        if (n !== null) { villageRename(n); chronRefresh(); }
      } else if (e.target.id === 'ch-copy') chronShare();
    });
  }
  Game.chronOpen = true;
  Game.chronNew = 0;
  el.classList.remove('hidden');
  chronRefresh();
}
function chronClose() { const el = document.getElementById('chron'); if (el) el.classList.add('hidden'); Game.chronOpen = false; }

function chronShare() {
  const t = chronText();
  try {
    if (navigator.share) { navigator.share({ title: 'Летопись деревни', text: t }).catch(() => {}); return; }
    if (navigator.clipboard) { navigator.clipboard.writeText(t).then(() => toast('Летопись скопирована')).catch(() => toast('Не удалось скопировать')); return; }
  } catch (e) { /* нет доступа */ }
  toast('Не удалось скопировать');
}

// ---------- Подключение ----------
{
  const _log = logEvent;
  logEvent = function (kind, text, x, y) {
    _log(kind, text, x, y);
    try {
      if (/утащил|Куры отомстили|защищая/.test(text)) chronCause = { t: Game.time, text };
      chronFromLog(kind, text);
    } catch (e) { console.warn(e); }
  };
  const _ru = removeUnit;
  removeUnit = function (u) {
    const was = u.dead;
    if (!was) { try { chronOnRemove(u); } catch (e) { console.warn(e); } }
    return _ru(u);
  };
  const _step = step;
  step = function (dt) { _step(dt); if (!chronMirror()) { try { chronTick(); } catch (e) { console.error(e); } } };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.chron = null; Game.chronPend = null; Game.chronNew = 0; chronCause = null; };
  const _sg = serializeGame;
  serializeGame = function () { const s = _sg(); if (Game.chron && Game.chron.e.length) s.chron = Game.chron; return s; };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    Game.chron = s.chron && Array.isArray(s.chron.e) ? Object.assign({ e: [], seen: {}, name: '', dayN: -1, dayC: 0, lost: 0 }, s.chron) : null;
    if (Game.chron && Game.chron.seen && !Game.chron.seen.intro) Game.chron.seen.intro = 1;
  };
}

// Кооп: клиент получает записи сервера по одной
function chronMirrorIn(ent) {
  if (!ent || !ent.s) return;
  const C = chronState();
  C.e.push(ent);
  if (C.e.length > CHRON_MAX) C.e.shift();
  Game.chronNew = (Game.chronNew || 0) + 1;
  if (Game.chronOpen) chronRefresh();
}

window.addEventListener('load', () => {
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-chron]')) chronOpen(); });
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyL') { if (Game.chronOpen) chronClose(); else chronOpen(); }
    if (e.code === 'Escape' && Game.chronOpen) chronClose();
  });
});
