'use strict';
// Найм прямо в окне здания (замена вкладки «Жители»): у каждого здания со своим мастером (b.def.worker) —
// кто здесь работает, кого из той же профессии можно поставить сюда (свободного или перевести из другого такого же
// здания — тогда они меняются местами) и кнопка «Обучить»: школа учит мастера, и выпускник идёт именно сюда
// (бронь b.hireReq, сохраняется и уходит клиентам коопа вместе со зданием). Мест по уровню — workSlots (levels.js):
// первый — b.worker, второй (ур.3) — просто гном с u.home === b.
// Кооп: кнопки шлют bact 'hire' (право train) и 'assign' (право manage), считает сервер.

function hireMirror() { return typeof Coop !== 'undefined' && !!Coop.mirror; }
function hireStaffed(b) { return !!(b.worker && !b.worker.dead && b.worker.home === b); }
const hireSlots = b => typeof workSlots === 'function' ? workSlots(b) : 1;
const hireStaff = b => typeof bldStaff === 'function' ? bldStaff(b) : (hireStaffed(b) ? [b.worker] : []);
const hireFull = b => hireStaff(b).length >= hireSlots(b);
// где гном сейчас мастером (первым или вторым) — или null
const hireFrom = u => u.home && !u.home.removed && u.home.def && u.home.def.worker === u.type ? u.home : null;

// Сколько мастеров этого ремесла сейчас учится во всех школах
function hirePending(type) {
  let n = 0;
  for (const s of Game.buildings) if (s.type === 'school' && !s.removed) {
    for (const q of s.queue || []) if (q === type) n++;
    if (s.training && s.training.type === type) n++;
  }
  return n;
}

// Подходящие гномы: та же профессия, живой, не в отряде и не герой. Свободные — первыми, затем ближние.
function hireCands(b) {
  const type = b.def.worker, out = [];
  if (!type) return out;
  for (const u of Game.units) {
    if (u.type !== type || u.dead || u.teamOf || u.home === b) continue;
    const from = hireFrom(u);
    out.push({ u, from, d: Math.abs(u.x - b.doorX) + Math.abs(u.y - b.doorY) + (from ? 1000 : 0) });
  }
  return out.sort((a, c) => a.d - c.d);
}

// Почему этого гнома сейчас нельзя поставить сюда (null — можно)
function hireWhyNot(b, u) {
  if (!b || b.removed || b.state !== 'done' || !b.def.worker) return 'Здание ещё не готово';
  if (!u || u.dead) return 'Гнома уже нет';
  if (u.type !== b.def.worker) return `Нужен ${UNIT_TYPES[b.def.worker].name.toLowerCase()}`;
  if (u.teamOf) return 'Он в отряде героя';
  if (u.home === b) return 'Он уже здесь';
  if (u.brk) return u.brk.kind === 'sleep' ? 'Спит после трактира — растолкайте позже' : 'На перекуре, сейчас вернётся';
  if (u.injury) return 'Травмирован — сначала лазарет';
  return null;
}

// Снять гнома с прежнего места: выходит из здания к двери, груз в руках кладёт кучкой
function hireDetach(u) {
  const old = u.home;
  if (old && old.worker === u) old.worker = Game.units.find(x => x !== u && x.home === old && !x.dead) || null;   // второй становится первым
  if (u.inside) { const ib = u.inside; u.inside = null; u.x = ib.doorX + 0.5; u.y = ib.doorY + 0.5; }
  if (u.carry) { if (typeof dropPile === 'function') dropPile(Math.floor(u.x), Math.floor(u.y), u.carry, u.carryN || 1); u.carry = null; }
  u.home = null;
  u.proc = null; u.action = null; u.anim = null;
  if (u.releaseOcc) u.releaseOcc();
}
function hireSeat(b, u) {
  u.home = b;
  if (!hireStaffed(b)) b.worker = u;
  u.idleFlag = false; u.idleStreak = 0;
}

// Поставить гнома сюда. Есть свободное место — просто встаёт; все места заняты, а новый пришёл из другого такого же
// здания — меняется местами с первым мастером.
function hireAssign(b, u) {
  const bad = hireWhyNot(b, u);
  if (bad) return bad;
  const from = hireFrom(u);
  const prev = hireFull(b) && hireStaffed(b) ? b.worker : null;
  hireDetach(u);
  if (prev) {
    hireDetach(prev);
    if (from && from.def.worker === prev.type) hireSeat(from, prev);
  }
  hireSeat(b, u);
  b.hireReq = 0;
  if (typeof logEvent === 'function') logEvent('people', `${UNIT_TYPES[u.type].name} теперь работает: «${b.def.name}»`, b.doorX + 0.5, b.doorY);
  return null;
}

// Почему нельзя учить сюда мастера (null — можно)
function hireTrainWhy(b) {
  const type = b.def.worker;
  if (!type || b.state !== 'done') return 'Здание ещё не готово';
  if (UNIT_TYPES[type].noTrain) return 'Этому ремеслу в школе не учат';
  if (b.hireReq && hirePending(type) > 0) return 'Мастер уже учится для этого здания';
  const schools = Game.buildings.filter(s => s.type === 'school' && s.state === 'done' && !s.removed);
  if (!schools.length) return 'Нужна готовая школа';
  if (schools.every(s => (s.queue || []).length >= 10)) return 'Очередь в школе заполнена';
  return null;
}

// «Обучить»: в школу с самой короткой очередью, выпускник придёт сюда
function hireTrain(b) {
  const bad = hireTrainWhy(b);
  if (bad) return bad;
  queueTraining(b.def.worker);
  b.hireReq = 1;
  return null;
}

// Школа выпустила мастера: если его ждёт здание с бронью — сразу туда (ближайшее, если таких несколько)
function hireOnGraduate(u) {
  let best = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (!b.hireReq || b.removed || b.state !== 'done' || b.def.worker !== u.type) continue;
    if (hireFull(b)) { b.hireReq = 0; continue; }
    const d = Math.abs(u.x - b.doorX) + Math.abs(u.y - b.doorY);
    if (d < bd) { bd = d; best = b; }
  }
  if (best) { hireSeat(best, u); best.hireReq = 0; }
}

// Примерно через сколько секунд школа выпустит ещё одного (в школе с самой короткой очередью)
function hireEta() {
  let best = null;
  for (const s of Game.buildings) if (s.type === 'school' && s.state === 'done' && !s.removed) {
    const T = TRAIN_TIME * (s.def.trainMult || 1);
    const t = ((s.queue || []).length + 1) * T + (s.training ? T - s.training.t : 0);
    if (best === null || t < best) best = t;
  }
  return best === null ? null : Math.max(1, Math.round(best));
}

function hireGoldLow() {
  let g = 0;
  for (const s of Game.buildings) if (s.isStore() || s.type === 'school') g += s.stock.gold || 0;
  return g < 1;
}

// Раскрытый список «Поставить другого» не захлопывается, когда окно перерисовывается
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('toggle', e => {
  const d = e.target;
  if (d && d.classList && d.classList.contains('hire-more') && typeof UI !== 'undefined') UI.hireOpen = d.open ? +d.dataset.hb : 0;
}, true);

function hireName(u) { return typeof chronName === 'function' ? chronName(u) : UNIT_TYPES[u.type].name; }
function hireLvl(u) { const L = typeof unitLevel === 'function' ? unitLevel(u) : 1; return L > 1 ? ` · ур. ${L}` : ''; }

// Блок «Работник» в окне здания (вместо прежней строки с одной кнопкой «Обучить»)
function hireHTML(b) {
  const type = b.def.worker, T = UNIT_TYPES[type];
  const staff = hireStaff(b), slots = hireSlots(b), full = staff.length >= slots;
  const pend = !full && b.hireReq && hirePending(type) > 0;
  const more = typeof workSlotsOf === 'function' && (b.level || 1) < 3 && workSlotsOf(b.type, 3) > slots ? ` · на 3-м ур. мест: ${workSlotsOf(b.type, 3)}` : '';
  let h = `<div class="isec">${slots > 1 ? 'Работники' : 'Работник'} · ${staff.length}/${slots}<span class="muted small">${more}</span></div>`;
  for (const w of staff) {
    const st = w.inside === b ? (b.working ? 'работает' : 'внутри') : 'в пути / снаружи';
    h += `<div class="irow"><img class="portrait" src="${portraitURL(type, w.look)}" alt="">
    <div><div>${hireName(w)} <span class="muted small">${T.name.toLowerCase()}${hireLvl(w)}</span></div><div class="small muted">${st}</div></div></div>`;
  }
  if (!full) h += `<div class="irow"><img class="portrait" src="${portraitURL(type, 3)}" alt="">
    <div><div>${T.name}</div><div class="small warn">${pend ? 'учится в школе — придёт сюда' : `места свободно: ${slots - staff.length}`}</div></div></div>`;

  const cands = hireCands(b);
  if (cands.length) {
    const rows = cands.slice(0, 4).map(c => {
      const bad = hireWhyNot(b, c.u);
      const where = c.from ? `работает: «${c.from.def.name}»` : 'свободен';
      return `<div class="irow hire-c"><img class="portrait" src="${portraitURL(type, c.u.look)}" alt="">
        <div style="flex:1"><div>${hireName(c.u)}<span class="muted small">${hireLvl(c.u)}</span></div><div class="small ${bad ? 'warn' : 'muted'}">${bad || where}</div></div>
        <button data-act="assign" data-u="${c.u.id}" ${bad ? 'disabled' : ''} title="${c.from && full ? 'Поменять местами' : 'Поставить сюда'}">${c.from && full ? 'Обмен' : 'Сюда'}</button></div>`;
    }).join('');
    h += full ? `<details class="hire-more" data-hb="${b.id}"${typeof UI !== 'undefined' && UI.hireOpen === b.id ? ' open' : ''}><summary class="small">Поставить другого: ${T.name.toLowerCase()} (${cands.length})</summary>${rows}</details>`
      : `<div class="small muted">Та же профессия в деревне:</div>${rows}`;
    if (cands.length > 4) h += `<div class="small muted">и ещё ${cands.length - 4}</div>`;
  }
  if (!full && !pend) {
    const bad = hireTrainWhy(b), eta = hireEta();
    const sub = bad || (`1 золото, ≈${eta || TRAIN_TIME} с · выпускник придёт сюда` + (hireGoldLow() ? ' · золота нет — начнут, когда привезут' : ''));
    h += `<button class="upg${bad ? ' no' : ''}" data-act="hire" ${bad ? 'disabled' : ''} title="Школа обучит мастера для этого здания"><span><b>Обучить: ${T.name.toLowerCase()}</b><small>${sub}</small></span></button>`;
  }
  return h;
}
