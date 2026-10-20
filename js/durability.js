'use strict';
// Запас прочности снаряжения и очередь заказов в мастерской доспехов.
// · У оружия и доспеха героя и рекрутов есть прочность (DUR в config.js): оружие тупится от ударов, доспех — от
//   пропущенных ударов. Ниже четверти — предупреждение и слабеющий удар, на нуле оружие бьёт вполсилы, доспех не защищает.
//   Прочность — очки на вид вещи (меч, лук, посох, кинжал, секира, доспехи) и на «качество»: стартовые ржавые вещи
//   класса хрупче настоящих. Герой хранит её по виду вещи (H.dur[вид]), рекрут — по слоту (R.dur.weapon/armor);
//   нет записи — вещь целая, поэтому старые сохранения ничего не теряют.
// · Ремонт — за материалы со склада кузницы (оружейная — оружие) или мастерской доспехов (доспехи): полный ремонт
//   стоит DUR.repairShare от цены новой вещи, частичный — пропорционально. Из панели здания, карточки героя и рекрута.
// · Мастерская доспехов: заказы в очередь (b.orders, сохраняются и уходят клиентам вместе со зданием).
// Считается там же, где вся игра (в общей деревне — на сервере); клиент только показывает (u.gx.dw / u.gx.da).
// Подключается последним: оборачивает strike, unitAtk, heroDef, hlHurt, injure, pickRecipe, infoBuilding, heroAbility.

const DUR_ORDER_MAX = 8;
const durName = k => (typeof hlName === 'function' ? hlName(k) : (GOODS[k] && GOODS[k].name) || k);
const durMirror = () => typeof Coop !== 'undefined' && !!Coop.on;
const durIsServer = () => typeof coop !== 'undefined';

function durMaxOf(k) {
  if (!k) return 0;
  if (DUR.max[k]) return DUR.max[k];
  const K = typeof KIT_ITEMS !== 'undefined' && KIT_ITEMS[k];
  return K && K.slot !== 'off' ? DUR.kit[K.slot] || 50 : 0;
}

// Ссылка на прочность вещи в слоте юнита: { k, max, get(), set(v) } или null (слот пуст / вещь не изнашивается)
function durRef(u, slot) {
  if (!u || u.dead) return null;
  let k = null, st = null, key = null;
  if (u.rec) {
    const R = u.rec, C = typeof GCLS !== 'undefined' && GCLS[R.cls];
    if (!C) return null;
    k = slot === 'weapon' ? C.weapon : R.armor ? C.armor : null;
    st = () => R.dur || (R.dur = {}); key = slot;
  } else if (u.type === 'hero' && u.hero && u.hero.equip) {
    const H = u.hero;
    if (slot !== 'weapon' && slot !== 'armor') return null;
    k = H.equip[slot]; st = () => H.dur || (H.dur = {}); key = k;
  }
  const max = durMaxOf(k);
  if (!k || !max) return null;
  return { k, max, slot, get: () => { const v = st()[key]; return v == null ? max : Math.max(0, Math.min(max, v)); }, set: v => { st()[key] = Math.max(0, Math.min(max, v)); } };
}
const durRatio = (u, slot) => { const r = durRef(u, slot); return r ? r.get() / r.max : null; };
const durPct = (u, slot) => { const r = durRatio(u, slot); return r == null ? null : Math.round(r * 100); };

const durAtkMul = r => r == null ? 1 : r <= 0 ? DUR.brokenAtk : r >= DUR.low ? 1 : 1 - (1 - 0.8) * (1 - r / DUR.low);
const durDefMul = r => r == null ? 1 : r >= DUR.low ? 1 : Math.max(0, r / DUR.low);

function durWarn(u, ref, broken) {
  const nm = durName(ref.k).toLowerCase(), where = ref.slot === 'weapon' ? 'оружейную' : 'мастерскую доспехов';
  const text = broken ? `${nm}: сломано!` : `${nm}: прочность на исходе — пора в ${where}`;
  floater(u.x, u.y - 1.9, broken ? 'Сломалось!' : 'Притупилось…', broken ? '#ff7a60' : '#f0c060');
  if (u.rec) { const b = typeof guildOf === 'function' ? guildOf(u) : null; gnews(`${u.rec.name || 'Рекрут'}: ${text}`, b); }
  else if (typeof gsay === 'function') gsay(u, `${u.hero.name || 'Герой'}: ${text}`);
}

function durWear(u, slot, amount) {
  const ref = durRef(u, slot);
  if (!ref || amount <= 0) return;
  const was = ref.get(), now = Math.max(0, was - amount), edge = ref.max * DUR.low;
  ref.set(now);
  if (was > 0 && now <= 0) durWarn(u, ref, true);
  else if (was > edge && now <= edge) durWarn(u, ref, false);
}

// ---------- Ремонт ----------

function durCost(k, frac) {
  const r = DUR.repair[k];
  if (!r) return null;
  const c = {};
  for (const g in r[1]) { const n = Math.ceil(r[1][g] * DUR.repairShare * frac - 1e-9); if (n > 0) c[g] = n; }
  if (!Object.keys(c).length) c[Object.keys(r[1])[0]] = 1;
  return c;
}
const durShopType = k => DUR.repair[k] ? DUR.repair[k][0] : null;
const durFree = (b, g) => (b.stock[g] || 0) - ((b.reserved && b.reserved[g]) || 0);
const durHas = (b, cost) => Object.keys(cost).every(g => durFree(b, g) >= cost[g]);
const durCostText = cost => Object.keys(cost).map(g => `${cost[g]} ${(GOODS[g].name || g).toLowerCase()}`).join(', ');

// Починить вещь в слоте юнита в мастерской b. null — готово, иначе причина отказа
function durRepair(u, slot, b) {
  const ref = durRef(u, slot);
  if (!ref) return 'Нечего чинить';
  const frac = 1 - ref.get() / ref.max;
  if (frac < 0.02) return 'Вещь целая';
  if (!b || b.removed || b.state !== 'done' || b.type !== durShopType(ref.k)) return 'Нужна ' + (durShopType(ref.k) === 'armory' ? 'мастерская доспехов' : 'оружейная');
  const cost = durCost(ref.k, frac);
  if (!durHas(b, cost)) return `В «${b.def.name}» не хватает материалов: ${durCostText(cost)}`;
  for (const g in cost) b.stock[g] -= cost[g];
  ref.set(ref.max);
  floater(u.x, u.y - 1.8, 'Как новое!', '#a8e090');
  if (typeof sfxAt === 'function') sfxAt('chime', u.x * TILE, u.y * TILE);
  return null;
}

// Ближайшая мастерская, где хватит материалов на ремонт вещи
function durFindShop(u, ref) {
  const cost = durCost(ref.k, 1 - ref.get() / ref.max), t = durShopType(ref.k);
  let best = null, bd = 1e9;
  for (const b of Game.buildings) {
    if (b.type !== t || b.state !== 'done' || b.removed || !durHas(b, cost)) continue;
    const d = Math.abs(b.doorX - u.x) + Math.abs(b.doorY - u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

// Починить всё, что нужно юниту; b — конкретная мастерская (иначе ближайшая). Возвращает текст итога
function durRepairUnit(u, only, b0) {
  const out = [];
  for (const slot of ['weapon', 'armor']) {
    if (only && only !== slot) continue;
    const ref = durRef(u, slot);
    if (!ref || ref.get() >= ref.max) continue;
    const shop = b0 && b0.type === durShopType(ref.k) ? b0 : b0 ? null : durFindShop(u, ref);
    const err = durRepair(u, slot, shop);
    out.push(err ? err : `${durName(ref.k)}: починено`);
  }
  return out.length ? out.join('; ') : 'Всё целое';
}

// ---------- Действия игрока (одиночная игра, хост, сервер по сообщению клиента) ----------

function durAct(s, who) {
  const p = String(s).split(':'), solo = typeof hlOn === 'function' && hlOn() && Game.hero;
  let msg = null;
  if (p[0] === 'ord') {
    const b = Game.buildings.find(x => x.id === +p[1] && x.def.orders && x.state === 'done'), i = +p[2], d = +p[3] > 0 ? 1 : -1;
    if (!b || !b.def.recipes || !b.def.recipes[i]) return null;
    b.orders = b.orders || [];
    const o = b.orders.find(x => x.i === i), tot = b.orders.reduce((a, x) => a + x.n, 0);
    if (d > 0) { if (tot >= DUR_ORDER_MAX) return 'Очередь заказов полна'; if (o) o.n++; else b.orders.push({ i, n: 1 }); }
    else if (o) { o.n--; if (o.n <= 0) b.orders.splice(b.orders.indexOf(o), 1); }
  } else if (p[0] === 'fixh') {
    if (!solo) return null;
    const b = p[2] ? Game.buildings.find(x => x.id === +p[2]) : null;
    msg = durRepairUnit(Game.hero, p[1] === 'armor' ? 'armor' : 'weapon', b);
  } else if (p[0] === 'fixr') {
    const u = Game.unitMap && Game.unitMap.get(+p[1]);
    if (u && u.rec) msg = durRepairUnit(u, null, null);
  } else if (p[0] === 'fixall') {
    const b = Game.buildings.find(x => x.id === +p[1]);
    if (!b) return null;
    let n = 0;
    for (const u of Game.units) if (u.rec && !u.dead) for (const slot of ['weapon', 'armor']) { const r = durRef(u, slot); if (r && r.get() < r.max && r.k && durShopType(r.k) === b.type && !durRepair(u, slot, b)) n++; }
    msg = n ? `Починено вещей: ${n}` : 'Нечего чинить или не хватает материалов';
  }
  if (msg) { if (who && durIsServer() && typeof coopSay === 'function') coopSay(who, msg); else if (typeof toast === 'function') toast(msg); }
  return msg;
}
function durSend(s) {
  if (durMirror()) { if (typeof coopSend === 'function') coopSend({ t: 'guild', a: 'dur', s }); }
  else durAct(s);
  if (typeof updateUI === 'function') updateUI(true);
}

// ---------- Износ в бою ----------

{
  const _strike = strike;
  strike = function (u, f) {
    const R = u.rec;
    let hid = false;
    if (R && R.armor && durRatio(u, 'armor') === 0) { R.armor = false; hid = true; }       // доспех сломан — не защищает
    try { _strike(u, f); } finally { if (hid) R.armor = true; }
    if (R || (u.type === 'hero' && u.hero)) {
      const ref = durRef(u, 'weapon');
      if (ref) durWear(u, 'weapon', DUR.wear[ref.k] != null ? DUR.wear[ref.k] : DUR.wear.weapon);
    }
  };
  const _ua = unitAtk;
  unitAtk = function (u) {
    const a = _ua(u);
    return u.rec || (u.type === 'hero' && u.hero) ? a * durAtkMul(durRatio(u, 'weapon')) : a;
  };
  const _def = heroDef;
  heroDef = function (u) {
    const d = _def(u), a = u.hero.equip && typeof GEAR_BONUS !== 'undefined' && GEAR_BONUS[u.hero.equip.armor];
    if (!a || !a.def) return d;
    return d - a.def * (1 - durDefMul(durRatio(u, 'armor')));
  };
  if (typeof hlHurt === 'function') {
    const _hh = hlHurt;
    hlHurt = function (u, n, why) {
      _hh(u, n, why);
      if (typeof why === 'string' && why !== 'fail' && why !== 'fright' && n >= 3 && u.type === 'hero') durWear(u, 'armor', DUR.wear.armor * Math.max(0.5, Math.min(2.5, n / 6)));
    };
  }
  const _inj = injure;
  injure = function (u, part) {
    const had = u.injury;
    _inj(u, part);
    if (u.rec && !had && u.injury) durWear(u, 'armor', DUR.wear.armor);
  };
}

// ---------- Новые вещи: прочность по умолчанию полная ----------

function durFresh(H, k) {
  if (!H || !H.dur || H.dur[k] == null) return;
  let n = 0;
  for (const sl in (H.equip || {})) if (H.equip[sl] === k) n++;
  for (const s of H.inv || []) if (s && s.k === k) n += s.n;
  if (n <= 1) delete H.dur[k];
}

// ---------- Очередь заказов ----------

{
  const _pick = pickRecipe;
  pickRecipe = function (b) {
    if (b.orders && b.orders.length && b.def.recipes) {
      for (let k = 0; k < b.orders.length; k++) {
        const o = b.orders[k], r = b.def.recipes[o.i];
        if (r && b.recipeOn[o.i] !== false && recipeCanRun(b, r)) { o.n--; if (o.n <= 0) b.orders.splice(k, 1); return r; }
      }
    }
    return _pick(b);
  };
}

// ---------- Интерфейс ----------

const durColor = r => r <= 0 ? '#c03a3a' : r < DUR.low ? '#e07a3a' : r < 0.5 ? '#e0b030' : '#5ac04a';
function durBar(r) {
  return `<span class="dur-bar" title="Прочность ${Math.round(r * 100)}%"><i style="width:${Math.max(r > 0 ? 4 : 0, Math.round(r * 100))}%;background:${durColor(r)}"></i></span>`;
}
function durState(r) { return r <= 0 ? '<b class="dur-bad">сломано</b>' : r < DUR.low ? `<b class="dur-low">${Math.round(r * 100)}%</b>` : `<b>${Math.round(r * 100)}%</b>`; }

// Строки прочности в карточке героя
function durHeroHTML(H) {
  const u = Game.hero;
  if (!u || u.hero !== H) return '';
  let x = '';
  for (const [slot, label, act] of [['weapon', 'Оружие', 'durw'], ['armor', 'Доспех', 'dura']]) {
    const ref = durRef(u, slot);
    if (!ref) continue;
    const r = ref.get() / ref.max, shop = r < 1 ? durFindShop(u, ref) : null;
    const tip = r >= 1 ? '' : shop ? `Починить в «${shop.def.name}»: ${durCostText(durCost(ref.k, 1 - r))}` : `Нужны материалы в ${durShopType(ref.k) === 'armory' ? 'мастерской доспехов' : 'оружейной'}: ${durCostText(durCost(ref.k, 1 - r))}`;
    x += `<div class="irow small dur"><span class="dur-l">${label}</span>${durBar(r)}${durState(r)}${r < 0.98 ? `<button class="hp-sm" data-hero="${act}" ${shop ? '' : 'disabled'} title="${tip}">Починить</button>` : ''}</div>`;
  }
  return x;
}
// Строки прочности в карточке рекрута (хост — по данным, клиент общей деревни — по u.gx.dw/da)
function durRecHTML(u) {
  let x = '';
  for (const [slot, label, key] of [['weapon', 'Оружие', 'dw'], ['armor', 'Доспех', 'da']]) {
    const p = u.rec ? durPct(u, slot) : u.gx ? u.gx[key] : null;
    if (p == null) continue;
    x += `<div class="irow small dur"><span class="dur-l">${label}</span>${durBar(p / 100)}${durState(p / 100)}</div>`;
  }
  const need = u.rec ? ['weapon', 'armor'].some(s => { const r = durRef(u, s); return r && r.get() < r.max; }) : u.gx && ((u.gx.dw != null && u.gx.dw < 100) || (u.gx.da != null && u.gx.da < 100));
  if (need) x += `<div class="hp-abs"><button class="hp-ab" data-rc="fix" title="Материалы возьмут в ближайшей оружейной или мастерской доспехов">Починить снаряжение</button></div>`;
  return x;
}
// Метка в списке рекрутов гильдии
function durTag(u) {
  const rs = u.rec ? ['weapon', 'armor'].map(s => durRatio(u, s)) : u.gx ? [u.gx.dw, u.gx.da].map(v => v == null ? null : v / 100) : [];
  const m = Math.min(...rs.filter(v => v != null), 9);
  return m <= 0 ? ' · <span class="dur-bad">сломано</span>' : m < DUR.low ? ' · <span class="dur-low">затупилось</span>' : '';
}

// Панель оружейной и мастерской доспехов: ремонт и очередь заказов
function durBuildingHTML(b) {
  let x = '';
  const recs = Game.units.filter(u => (u.rec || (durMirror() && u.gx)) && !u.dead);
  if (b.def.orders) {
    const rs = b.def.recipes, ord = b.orders || [];
    x += '<div class="isec">Очередь заказов</div>';
    const rows = [['leatherArmor', 0], ['ironArmor', 1]];
    for (const [g, i] of rows) {
      const r = rs[i];
      if (!r) { x += `<div class="irow small muted">${gi(g)} ${GOODS[g].name}: только в мастерской 2-го уровня</div>`; continue; }
      const o = ord.find(q => q.i === i), cost = Object.keys(r.in).map(m => `${gi(m)}${r.in[m]}`).join(' ');
      x += `<div class="irow small dur-ord"><span>${gi(g)} ${GOODS[g].name} · ${cost} · ${r.time}с</span><span class="dur-q"><button class="hp-sm" data-dur="ord:${b.id}:${i}:-1" ${o ? '' : 'disabled'}>−</button><b>${o ? o.n : 0}</b><button class="hp-sm" data-dur="ord:${b.id}:${i}:1">+</button></span></div>`;
    }
    x += `<div class="irow small muted">Заказы делаются первыми; без заказов мастерская шьёт кожаные по кругу. Железный доспех — дорогой: ${DUR_ORDER_MAX} заказов в очереди максимум.</div>`;
  }
  if (b.def.worker && (b.type === 'weaponsmith' || b.type === 'armory')) {
    x += '<div class="isec">Ремонт снаряжения</div>';
    const H = !durMirror() && Game.hero && Game.hero.hero && typeof hlOn === 'function' && hlOn() ? Game.hero : null;
    let any = false;
    if (H) for (const slot of ['weapon', 'armor']) {
      const ref = durRef(H, slot);
      if (!ref || durShopType(ref.k) !== b.type) continue;
      any = true;
      const r = ref.get() / ref.max, cost = durCost(ref.k, 1 - r);
      x += `<div class="irow small dur"><span class="dur-l">Герой: ${durName(ref.k)}</span>${durBar(r)}${durState(r)}${r < 0.98 ? `<button class="hp-sm" data-dur="fixh:${slot}:${b.id}" ${durHas(b, cost) ? '' : 'disabled'} title="${durCostText(cost)}">Починить</button>` : ''}</div>`;
    }
    const worn = recs.filter(u => ['weapon', 'armor'].some(s => { const r = u.rec ? durRef(u, s) : null; return r ? r.get() < r.max && durShopType(r.k) === b.type : false; })).length;
    if (worn) x += `<div class="irow small">Рекрутам нужен ремонт: <b>${worn}</b> <button class="hp-sm" data-dur="fixall:${b.id}">Починить всех</button></div>`;
    else if (durMirror() && recs.some(u => u.gx && ((u.gx.dw != null && u.gx.dw < 100) || (u.gx.da != null && u.gx.da < 100)))) x += `<div class="irow small">Рекрутам нужен ремонт <button class="hp-sm" data-dur="fixall:${b.id}">Починить всех</button></div>`;
    else if (!any) x += '<div class="irow small muted">Снаряжение целое. Материалы на ремонт берутся из запасов этого здания.</div>';
  }
  return x;
}

{
  const _ib = infoBuilding;
  infoBuilding = function (b) {
    let h = _ib(b);
    if (b.state === 'done' && !b.upg && !b.isRoad && (b.type === 'weaponsmith' || b.type === 'armory')) {
      const x = durBuildingHTML(b), i = h.lastIndexOf('<div class="idesc">');
      h = i >= 0 ? h.slice(0, i) + x + h.slice(i) : h + x;
    }
    return h;
  };
  if (typeof heroAbility === 'function') {
    const _ab = heroAbility;
    heroAbility = function (k) {
      if (k === 'durw' || k === 'dura') { durSend('fixh:' + (k === 'durw' ? 'weapon' : 'armor')); return; }
      _ab(k);
    };
  }
}

if (typeof document !== 'undefined') {
  const st = document.createElement('style');
  st.textContent = `.dur{display:flex;align-items:center;gap:5px}.dur-l{min-width:50px;color:#c9bfa6;white-space:nowrap}.dur .hp-sm{margin-left:auto}
.dur-bar{display:inline-block;width:52px;height:7px;background:#1b1812;border:1px solid #5a4a30;border-radius:2px;overflow:hidden}.dur-bar i{display:block;height:100%}
.dur-low{color:#e8903a}.dur-bad{color:#e85a48}.dur-ord{display:flex;justify-content:space-between;align-items:center;gap:6px}.dur-q{display:inline-flex;align-items:center;gap:6px}`;
  document.head.appendChild(st);
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-dur]');
    if (t && !t.disabled) { e.stopPropagation(); durSend(t.dataset.dur); }
  }, true);
}
