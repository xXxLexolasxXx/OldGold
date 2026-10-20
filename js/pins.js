'use strict';
// Закреплённые подсказки вверху экрана — над оповещениями (общая очередь notify.js).
// Важное (голод, школа без золота, нечем топить плавильни, стройка без досок, сено и еда на зиму, ночь близко)
// висит компактной плашкой, пока не решено, а не всплывает тостом каждые сутки. Нажатие ведёт к месту (камера к зданию).
// Появление записывается в журнал оповещений как важное — один раз за появление. Считается на клиенте по видимому
// состоянию (в кооперативе — по зеркалу), раз в 2 с; плашка появляется и пропадает только после двух проверок подряд.

const Pins = { cur: new Map(), seen: new Map(), el: null, t: 0, food: [] };
const PIN_MAX = () => (document.body.classList.contains('mobile') ? 2 : 3);

const pinDone = b => b && b.state === 'done' && !b.removed;
const pinAll = type => Game.buildings.filter(b => b.type === type && pinDone(b));
function pinStore(g) {
  let n = 0;
  for (const b of Game.buildings) if (pinDone(b) && b.isStore && b.isStore()) n += Math.max(0, (b.stock[g] || 0) - (b.reserved[g] || 0));
  return n;
}
// здания, которые стоят без товара g (problem() === 'need:g')
function pinNeed(g) {
  const out = [];
  for (const b of Game.buildings) { if (!pinDone(b) || typeof b.problem !== 'function') continue; try { if (b.problem() === 'need:' + g) out.push(b); } catch (e) { /* зеркало без методов */ } }
  return out;
}
const pinDays = n => n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'сутки' : 'суток');

// Каждое правило — { id, sev (0 инфо, 1 важно, 2 срочно), ico, text, tip, target }
function pinRules() {
  const out = [];
  const add = (id, sev, ico, text, tip, target) => out.push({ id, sev, ico, text, tip: tip || text, target: target || null });
  const ppl = Game.units.filter(u => !u.dead && !u.noFood && typeof isPerson === 'function' && isPerson(u));
  const inns = pinAll('inn');
  const FOODS = typeof SEA_MEAL_FOODS !== 'undefined' ? SEA_MEAL_FOODS : ['bread', 'sausage', 'chicken', 'croissant', 'steak'];

  // ---- Голод: сколько обедов в трактирах и на складах и куда идёт запас
  let meals = 0;
  for (const b of Game.buildings) if (pinDone(b) && (b.type === 'inn' || (b.isStore && b.isStore()))) for (const g of FOODS) meals += b.stock[g] || 0;
  if (Pins.food.length && Game.time < Pins.food[Pins.food.length - 1][0]) Pins.food = [];   // загрузили другую игру
  Pins.food.push([Game.time, meals]);
  while (Pins.food.length > 2 && Game.time - Pins.food[0][0] > 180) Pins.food.shift();
  const hungry = ppl.filter(u => u.food < (typeof HUNGRY !== 'undefined' ? HUNGRY : 0.3)).length;
  if (ppl.length && hungry >= Math.max(2, ppl.length * 0.2) && meals === 0) {
    add('famine', 2, '🍞', `Голод: еды нет — голодных ${hungry}`, 'Ни в трактире, ни на складе нет хлеба и колбасы. Нужны ферма → мельница → пекарня или свинарник → бойня, и трактир рядом с дорогой.', inns[0] || pinAll('bakery')[0]);
  } else if (ppl.length > 4 && Pins.food.length > 2) {
    const [t0, m0] = Pins.food[0], dt = Game.time - t0;
    const rate = dt > 60 ? (m0 - meals) / dt : 0;                           // обедов в секунду (убыль)
    if (rate > 0) {
      const mins = Math.round(meals / rate / 60);
      if (mins <= 6) add('hunger', mins <= 2 ? 2 : 1, '🍞', `Голод через ~${Math.max(1, mins)} мин: еды ${meals}`, 'Едят быстрее, чем пекут и коптят. Заложи ещё полей у ферм, поставь вторую пекарню или бойню.', inns[0]);
    }
  }

  // ---- Школа без золота
  const schools = pinAll('school');
  const stuck = schools.find(b => (b.queue && b.queue.length) && !b.training && (b.stock.gold || 0) < 1);
  if (stuck && pinStore('gold') < 1) {
    const mines = pinAll('goldmine').length, smelt = pinAll('metallurgist');
    const why = !mines ? 'построй золотой рудник у скал' : !smelt.length ? 'нужна плавильня золота' : pinNeed('trunk').some(b => b.type === 'metallurgist') ? 'плавильне не хватает брёвен' : pinNeed('goldore').length ? 'руднику не хватает руды' : 'золото ещё плавится';
    add('gold', 2, '🪙', `Нет золота для школы — ${why}`, `Учёба стоит: каждому ученику нужен 1 слиток. В очереди: ${stuck.queue.length}.`, stuck);
  }

  // ---- Брёвна (дрова для плавилен)
  const cold = pinNeed('trunk');
  if (cold.length && pinStore('trunk') < 1) add('trunk', 1, '🪵', `Мало брёвен: стоят ${cold.length} ${cold.length === 1 ? 'плавильня' : 'плавильни'}`, 'Брёвна — дрова для плавилен и сырьё лесопилки. Поставь ещё дом лесоруба у леса.', cold[0]);

  // ---- Стройка без досок или камня
  for (const g of ['timber', 'stone']) {
    const sites = Game.buildings.filter(b => b.state !== 'done' && !b.removed && typeof b.demand === 'function' && b.demand(g) > 0 && !(b.incoming[g] > 0));
    if (sites.length && pinStore(g) < 1) {
      const src = g === 'timber' ? 'лесопилку и лесоруба' : 'каменоломню у камней';
      add('build-' + g, 1, g === 'timber' ? '🪚' : '🪨', `Стройка ждёт: нет ${g === 'timber' ? 'досок' : 'камня'} (${sites.length})`, `Склад пуст — нужна ${src}.`, sites[0]);
    }
  }

  // ---- Зима: сено и еда
  if (typeof seaIdx === 'function' && Game.sea && Game.sea.fixed == null) {
    const i = seaIdx(), d = seaDaysToWinter();
    const mirror = typeof isMirror === 'function' && isMirror();
    const h = mirror ? Game.sea.hay : seaHayInfo();
    const f = typeof seaFoodInfo === 'function' ? seaFoodInfo() : null;
    const farm = pinAll('farm')[0];
    if (i === 1 || (i === 0 && d <= 2)) {
      const lackH = h && h.need > h.have, lackF = f && f.need > f.have;
      if (lackH || lackF) {
        const parts = [lackH ? `сено ${h.have}/${h.need}` : '', lackF ? `еда ${f.have}/${f.need}` : ''].filter(Boolean).join(' · ');
        const hint = !farm ? 'Построй ферму и заложи вокруг поля пшеницы.' : lackH && !pinAll('swine').length && !pinAll('storehouse').length ? 'Построй сеновал-склад.' : 'Больше полей пшеницы у ферм: зерно — на хлеб, солома — на сено. Свиньи осенью не плодятся, пока сена мало.';
        add('winter', d <= 2 ? 2 : 1, '❄', `Зима через ${pinDays(d)}: ${parts}`, `Зимой ничего не растёт. ${hint} Еда считается в обедах: хлеб, колбаса, а также зерно и мука (×3) и свиньи (×3).`, lackH ? (typeof seaHayPlace === 'function' ? seaHayPlace() : farm) : farm || inns[0]);
      }
    }
    if (i === 2) {
      if (h && h.need && h.have < h.need * 0.25 && pinAll('swine').some(b => (b.pigs && b.pigs.length) || b.stock.pig)) add('hay', 2, '🌾', `Скоту не хватит сена: ${h.have} из ${h.need}`, 'Свиньи без сена гибнут по одной за кормёжку. Продай часть свиней на бойню или купи сено у обоза.', pinAll('swine')[0]);
      if (f && f.need > f.have * 1.2) add('wfood', 1, '🍞', `Еды до весны мало: ${f.have} из ${f.need}`, 'Зимой поля стоят — хлеб пекут только из запаса зерна. Береги зерно: выключи пивоварню, купи еду у обоза.', inns[0]);
    }
  }

  // ---- Ночь близко (инфо): вечер, ещё не стемнело
  if (typeof isEveningNow === 'function' && isEveningNow() && !isNightNow()) add('night', 0, '☾', 'Ночь близко — гномы спешат к костру', 'Ночью выходит нечисть; вне света костра опасно.', pinAll('bonfire')[0]);
  return out;
}

function pinsUpdate() {
  const on = Notify.entry && Notify.entry.step > 5 && Game.units && Game.units.length && !(typeof StartMenu !== 'undefined' && StartMenu.open);
  const now = new Map();
  if (on) { try { for (const p of pinRules()) now.set(p.id, p); } catch (e) { if (!pinsUpdate.err) { pinsUpdate.err = 1; console.error(e); } } }
  // гистерезис: две проверки подряд, чтобы плашки не мигали
  for (const [id, p] of now) {
    const s = Pins.seen.get(id) || 0;
    Pins.seen.set(id, Math.max(1, s + 1));
    if (Pins.cur.has(id) || s >= 1) {
      if (!Pins.cur.has(id) && p.sev > 0) Notify.note(p.text, 'pin', p.target);   // в журнал — один раз за появление
      Pins.cur.set(id, p);
    }
  }
  for (const id of [...Pins.seen.keys()]) if (!now.has(id)) {
    const s = Pins.seen.get(id);
    if (s > 0) Pins.seen.set(id, -1); else { Pins.seen.delete(id); Pins.cur.delete(id); }
  }
  pinsDraw();
}

function pinsDraw() {
  let el = Pins.el;
  const view = document.getElementById('view'), box = document.getElementById('toasts');
  if (!view || !box) return;
  if (!el) {
    el = Pins.el = document.createElement('div');
    el.id = 'nq-pins';
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-pin]');
      if (!b) return;
      const p = Pins.cur.get(b.dataset.pin);
      if (p && p.target && !p.target.removed && typeof focusBuilding === 'function') focusBuilding(p.target);
      else if (b.dataset.pin === 'more') Notify.journal();
    });
    view.appendChild(el);
  }
  const list = [...Pins.cur.values()].sort((a, b) => b.sev - a.sev);
  const max = PIN_MAX(), shown = list.slice(0, max);
  const key = shown.map(p => p.id + p.sev + p.text).join('|') + list.length;
  if (key !== Pins.key) {
    Pins.key = key;
    const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    el.innerHTML = shown.map(p => `<button data-pin="${p.id}" class="s${p.sev}" title="${esc(p.tip)}"><i>${p.ico}</i>${esc(p.text)}${p.target ? '<u>▸</u>' : ''}</button>`).join('') +
      (list.length > max ? `<button data-pin="more" class="s0" title="Журнал оповещений">+${list.length - max}</button>` : '');
  }
  // встаём туда, где начинаются тосты, а их сдвигаем ниже
  const cs = getComputedStyle(box);
  el.style.top = cs.top; el.style.left = cs.left; el.style.transform = cs.transform === 'none' ? '' : cs.transform;
  el.classList.toggle('hidden', !shown.length);
  const hgt = shown.length ? el.offsetHeight + 4 : 0;
  box.style.marginTop = hgt ? hgt + 'px' : '';
}

{
  const css = document.createElement('style');
  css.textContent = `
  #nq-pins{position:absolute;z-index:18;display:flex;flex-wrap:wrap;justify-content:center;gap:4px;max-width:min(560px,94vw);pointer-events:none}
  #nq-pins.hidden{display:none}
  #nq-pins button{pointer-events:auto;display:flex;align-items:center;gap:6px;padding:3px 10px 3px 6px;min-height:28px;max-width:100%;cursor:pointer;
    font:13px/1.2 Kurale,Georgia,serif;color:#2a1608;text-align:left;background:linear-gradient(#f1dfb2,#d9bd84);border:1px solid #6a3c12;border-radius:3px;
    box-shadow:0 2px 6px rgba(0,0,0,.5)}
  #nq-pins button i{font-style:normal;font-size:15px;line-height:1}
  #nq-pins button u{text-decoration:none;opacity:.6}
  #nq-pins button.s2{background:linear-gradient(#ffd0b0,#e89a74);border-color:#8a1c12;animation:pinPulse 2.4s ease-in-out infinite}
  #nq-pins button.s0{background:linear-gradient(#d8d4e8,#a8a2c4);border-color:#3a3460}
  @keyframes pinPulse{50%{box-shadow:0 0 0 2px rgba(200,40,20,.55),0 2px 6px rgba(0,0,0,.5)}}
  body.mobile #nq-pins button{min-height:32px;font-size:12.5px}`;
  document.head.appendChild(css);
}
if (typeof getComputedStyle === 'function') setInterval(() => { if (Game && Game.buildings) pinsUpdate(); }, 2000);   // только в браузере
