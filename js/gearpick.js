'use strict';
// Вещи на земле и в рюкзаке героя (одиночная игра, 0.11.55).
// Раньше касание кучки с мечом давало приказ «Убрать кучу»: герой нёс меч на склад, а трудяги уносили его сами
// раньше, чем игрок успевал что-то сделать. Теперь:
// · снаряжение, упавшее на землю (сова уронила, сундук, герой выложил), полторы минуты ждёт героя — трудяги его не трогают,
//   над кучкой золотое кольцо;
// · касание такой кучки — короткое меню: «В руку героя» (подобрать и надеть), «В рюкзак», «Пусть отнесут на склад»;
// · касание (или правый клик) вещи в рюкзаке — меню: надеть/съесть, положить на землю, отнести на склад, выбросить;
// · при первой такой находке — подсказка (Guide, один раз на устройство).
// В общей деревне (Coop) не работает: там рюкзак считает сервер.
// Подключается после guide.js, herocard.js, heroabil.js и arms.js.

const GP_HOLD = 90;                 // игровых секунд снаряжение на земле ждёт героя
const gpOn = () => typeof hlOn === 'function' && hlOn() && Game.hero && Game.hero.hero && !Game.hero.dead;
const gpGear = g => !!(HL_GEAR[g] && GOODS[g]);
const gpFree = (p, g) => p.stock[g] - p.reserved[g];
const gpGearIn = p => GOOD_KEYS.find(g => gpGear(g) && gpFree(p, g) > 0) || null;
const gpHeld = p => p && !p.removed && p.heroHold > Game.time && !!gpGearIn(p);
const gpRoom = (H, g) => H.inv.some(s => !s || (s.k === g && s.n < 20));
const gpSrvOn = () => typeof isServer === 'function' && isServer();   // сервер общей деревни
const gpCoopOn = () => typeof Coop !== 'undefined' && Coop.on && Game.hero && Game.hero.hero;   // клиент общей деревни
// сообщение игроку: в общей деревне — тому, чей герой; в одиночной — всплывашкой
const gpSay = (u, text) => { if (u && u.hero && u.hero.owner && typeof coopSay === 'function') coopSay(u.hero.owner, text); else toast(text); };

// ---------- Снаряжение на земле ждёт героя ----------
{
  const _offer = Pile.prototype.offer;
  Pile.prototype.offer = function (g) { return this.heroHold > Game.time && gpGear(g) ? 0 : _offer.call(this, g); };
  const _drop = dropPile;
  dropPile = function (x, y, g, n) {
    const p = _drop(x, y, g, n);
    if (p && gpGear(g) && (gpOn() || gpSrvOn())) p.heroHold = Game.time + GP_HOLD;
    return p;
  };
}

// ---------- Меню ----------
let gpMenuEl = null, gpLastXY = null;
document.addEventListener('pointerdown', e => {
  gpLastXY = [e.clientX, e.clientY];
  if (gpMenuEl && !gpMenuEl.contains(e.target)) gpMenuClose();
}, true);
window.addEventListener('keydown', e => { if (e.code === 'Escape' && gpMenuEl) gpMenuClose(); });

function gpMenuClose() { if (gpMenuEl) { gpMenuEl.remove(); gpMenuEl = null; } }

// items: [{ t: текст, d: пояснение, f: действие, main: true — главная кнопка }]
function gpMenu(title, icon, items, xy) {
  gpMenuClose();
  const el = gpMenuEl = document.createElement('div');
  el.className = 'gp-menu';
  el.innerHTML = `<div class="gp-h"><img src="${iconURL('good', icon, 2)}" alt=""><b>${title}</b><button class="gp-x" title="Закрыть">✕</button></div>`
    + items.map((it, i) => `<button class="gp-b${it.main ? ' main' : ''}" data-i="${i}"><b>${it.t}</b>${it.d ? `<small>${it.d}</small>` : ''}</button>`).join('');
  const t0 = performance.now();
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('gp-x')) { gpMenuClose(); return; }
    if (performance.now() - t0 < 250) return;          // второй тап того же касания
    const it = items[+b.dataset.i];
    gpMenuClose();
    if (it) { it.f(); updateUI(true); }
  });
  document.body.appendChild(el);
  const [x, y] = xy || gpLastXY || [innerWidth / 2, innerHeight / 2], r = el.getBoundingClientRect(), pad = 8;
  el.style.left = Math.round(Math.max(pad, Math.min(innerWidth - r.width - pad, x - r.width / 2))) + 'px';
  el.style.top = Math.round(Math.max(pad + 40, Math.min(innerHeight - r.height - pad, y + 14))) + 'px';
}

// ---------- Кучка на земле ----------

function gpPileMenu(p) {
  const h = Game.hero, H = h.hero, g = gpGearIn(p);
  if (!g) return false;
  const nm = hlName(g), room = gpRoom(H, g);
  const go = (equip, label) => {
    if (!room) { toast('Рюкзак героя полон: выложите или выбросите что-нибудь'); return; }
    issueCmd(h, { kind: 'grab', p, g, equip, tx: p.x, ty: p.y, label });
    floater(p.x + 0.5, p.y - 0.4, label, '#f6d458');
  };
  gpMenu(nm, g, [
    { t: 'В руку героя', d: `${H.name} подберёт и наденет${H.equip[HL_GEAR[g].slot] ? ' (старое — в рюкзак)' : ''}`, main: true, f: () => go(true, 'Взять в руку') },
    { t: 'В рюкзак', d: 'подобрать, надеть потом', f: () => go(false, 'Взять в рюкзак') },
    { t: 'Пусть отнесут на склад', d: 'трудяги заберут', f: () => { p.heroHold = 0; toast(`${nm}: трудяги отнесут на склад`); } },
  ]);
  if (!room) toast('Рюкзак героя полон — сначала освободите место');
  return true;
}

function* gpGrabGen(u, c) {
  const p = c.p, H = u.hero;
  const ok = yield { walk: [p.x, p.y], offroad: true };
  if (!ok) return;
  const g = !p.removed && gpFree(p, c.g) > 0 ? c.g : (!p.removed && gpGearIn(p));
  if (!g) { floater(u.x, u.y - 1.6, 'Уже унесли…', '#e8a070'); return; }
  if (!gpRoom(H, g)) { floater(u.x, u.y - 1.6, 'Рюкзак полон', '#e8a070'); gpSay(u, 'Рюкзак героя полон: выложите или выбросите что-нибудь'); return; }
  yield { wait: 0.5, anim: 'duck' };
  if (p.removed || gpFree(p, g) <= 0) { floater(u.x, u.y - 1.6, 'Уже унесли…', '#e8a070'); return; }
  p.stock[g]--; cleanupPile(p);
  hlAddItem(H, g, 1);
  if (typeof durFresh === 'function') durFresh(H, g);
  floater(u.x, u.y - 1.6, 'Взял: ' + hlName(g), '#ffe8a0');
  updateUI(true);
  if (!c.equip || !H.equip) return;
  const slot = H.inv.findIndex(s => s && s.k === g);
  if (slot < 0) return;
  yield* hlEquipGen(u, { slot });
  if (H.equip[HL_GEAR[g].slot] !== g) gpSay(u, `Не вышло надеть — ${hlName(g).toLowerCase()} в рюкзаке. Нажмите на него в рюкзаке, чтобы попробовать ещё`);
  updateUI(true);
}

// ---------- Рюкзак ----------

function gpSlotMenu(i, xy) {
  const h = Game.hero, H = h.hero, s = H.inv[i];
  if (!s) return;
  const g = s.k, nm = hlName(g), many = s.n > 1 ? ` ×${s.n}` : '';
  const items = [];
  if (HL_GEAR[g]) items.push({ t: 'Надеть', d: 'получается через раз', main: true, f: () => heroAbility('use' + i) });
  else if (HL_FOOD[g]) items.push({ t: 'Съесть', d: 'сытость и немного здоровья', main: true, f: () => heroAbility('use' + i) });
  else if (g === 'bandage') items.push({ t: 'Перевязаться', main: true, f: () => heroAbility('use' + i) });
  items.push({ t: 'Положить на землю', d: 'рядом с героем', f: () => gpPutDown(i) });
  if (GOODS[g] && !GOODS[g].noStore) items.push({ t: 'Отнести на склад', d: 'герой сам сходит', f: () => gpToStore(i) });
  items.push({ t: 'Выбросить насовсем', d: 'вещь пропадёт', f: () => { hlDrop(i); toast(`Выброшено: ${nm}${many}`); } });
  gpMenu(nm + many, g, items, xy);
}

function gpPutDown(i) {
  const h = Game.hero, H = h.hero, s = H.inv[i];
  if (!s) return;
  if (H.stunUntil > Game.time) { toast(`${H.name} сейчас не может`); return; }
  let x = Math.floor(h.x), y = Math.floor(h.y);
  if (h.inside) { x = h.inside.doorX; y = h.inside.doorY; }
  const p = dropPile(x, y, s.k, s.n);
  if (!p) { toast('Здесь некуда положить'); return; }
  H.inv[i] = null;
  floater(p.x + 0.5, p.y - 0.4, 'Положил: ' + hlName(s.k), '#ffe8a0');
}

function gpToStore(i) {
  const h = Game.hero, s = h.hero.inv[i];
  if (!s) return;
  const st = nearestStore(h.x, h.y, s.k);
  if (!st) { toast('Нет склада, куда отнести'); return; }
  issueCmd(h, { kind: 'stashInv', k: s.k, st, tx: st.doorX, ty: st.doorY, label: 'Отнести на склад' });
}

function* gpStashGen(u, c) {
  const H = u.hero, st = c.st;
  const ok = yield { walk: [st.doorX, st.doorY] };
  if (!ok || st.removed || !st.isStore()) return;
  const i = H.inv.findIndex(s => s && s.k === c.k);
  if (i < 0) return;
  yield { enter: st };
  yield { wait: 0.8 };
  const s = H.inv[i];
  if (s && s.k === c.k && !st.removed) {
    st.stock[s.k] += s.n; H.inv[i] = null;
    floater(u.x, u.y - 1.6, 'Сдал на склад: ' + hlName(c.k), '#ffe8a0');
  }
  yield { leave: true };
  updateUI(true);
}

// ---------- Подключение ----------
{
  const _click = onLeftClickTile;
  onLeftClickTile = function (t) {
    if (gpOn() && !Game.tool && inb(t[0], t[1])) {        // кучка бывает и на клетке входа (у костра широкий вход): вещь важнее
      const p = Game.piles.get(idx(t[0], t[1]));
      if (p && !p.removed && gpGearIn(p) && gpPileMenu(p)) return;
    }
    if (gpCoopOn() && !Game.tool && inb(t[0], t[1])) {
      const p = Game.piles.get(idx(t[0], t[1]));
      if (p && !p.removed && gpGearIn(p) && gpCoopPileMenu(p)) return;
    }
    _click(t);
  };

  const _rc = resolveCmd;
  resolveCmd = function (t) {
    const c = _rc(t);
    if (c && c.kind === 'pile' && (gpOn() || gpCoopOn())) { const g = gpGearIn(c.p); if (g) c.label = hlName(g) + ': взять?'; }
    return c;
  };

  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'grab') yield* gpGrabGen(u, c);
    else if (c.kind === 'stashInv') yield* gpStashGen(u, c);
    else yield* _run(u, c);
  };

  // рюкзак: касание и правый клик по вещи — меню вместо мгновенного действия (и вместо «выбросить» без спроса)
  const slotOf = e => gpOn() && e.target.closest && e.target.closest('.hl-slot[data-hero^="use"]');
  document.addEventListener('click', e => {
    const el = slotOf(e);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    gpSlotMenu(+el.dataset.hero.slice(3), [e.clientX, e.clientY]);
  }, true);
  document.addEventListener('contextmenu', e => {
    const el = slotOf(e);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    gpSlotMenu(+el.dataset.hero.slice(3), [e.clientX, e.clientY]);
  }, true);

  // подписи в карточке героя
  const fix = html => html
    .replace(/\. Правый клик — выбросить"/g, '. Нажмите: надеть, положить, на склад"')
    .replace(/(Рюкзак \(\d+\/\d+\))/, '$1 · <span class="gp-tip">нажмите на вещь</span>');
  if (typeof hcHeroHTML === 'function') { const _hh = hcHeroHTML; hcHeroHTML = function () { return fix(_hh()); }; }

  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    const co = gpCoopOn();          // в общей деревне бронь не приходит с сервера — кольцо у любого снаряжения
    if (!gpOn() && !co) return;
    const t = Game.time;
    for (const p of Game.piles.values()) {
      if (co ? p.removed || !gpGearIn(p) : !gpHeld(p)) continue;
      const px = (p.x + 0.5) * TILE, py = (p.y + 0.5) * TILE + 4, k = 0.5 + 0.5 * Math.sin(t * 5);
      c.strokeStyle = `rgba(255,214,90,${0.55 + 0.4 * k})`; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(px, py, 11 + 2 * k, 5 + k, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffe070'; c.fillRect(px - 1, py - 26 - 2 * k, 3, 7); c.fillRect(px - 1, py - 17 - 2 * k, 3, 3);
    }
  };

  const _rs = resetGameState;
  resetGameState = function () { _rs(); gpMenuClose(); };
}


// ---------- Общая деревня ----------
// Экипировки в коопе нет (оружие героя — от класса), поэтому «В руку» нет: вещь — в рюкзак, на землю или на склад.
// Сервер (coopsim.js): команды grab / release / putdown / stash; клиент — те же меню, что в одиночной игре.

function gpCoopCmd(u, m) {
  const H = u.hero;
  if (m.t === 'grab' || m.t === 'release') {
    const p = Number.isInteger(m.x) && Number.isInteger(m.y) && inb(m.x, m.y) ? Game.piles.get(idx(m.x, m.y)) : null;
    const g = p && !p.removed && gpGearIn(p);
    if (!g) return;
    if (m.t === 'release') { p.heroHold = 0; return; }
    if (H.stunUntil > Game.time) return;
    issueCmd(u, { kind: 'grab', p, g, equip: false, tx: p.x, ty: p.y, label: 'Взять в рюкзак' });
    return;
  }
  if (!Number.isInteger(m.slot) || m.slot < 0 || m.slot >= H.inv.length) return;
  const s = H.inv[m.slot];
  if (!s || !GOODS[s.k]) { if (s) coopSay(H.owner, 'Это из рюкзака не выложить'); return; }     // задания (эстафета, груз) — только передать
  if (m.t === 'putdown') {
    const p = dropPile(Math.floor(u.x), Math.floor(u.y), s.k, s.n);
    if (p) { H.inv[m.slot] = null; floater(p.x + 0.5, p.y - 0.4, 'Положил: ' + hlName(s.k), '#ffe8a0'); }
  } else if (m.t === 'stash') {
    const st = nearestStore(u.x, u.y, s.k);
    if (!st) { coopSay(H.owner, 'Нет склада, куда отнести'); return; }
    issueCmd(u, { kind: 'stashInv', k: s.k, st, tx: st.doorX, ty: st.doorY, label: 'Отнести на склад' });
  }
}

function gpCoopPileMenu(p) {
  const g = gpGearIn(p);
  if (!g) return false;
  const send = (t, label) => { coopSend({ t, x: p.x, y: p.y }); if (label) floater(p.x + 0.5, p.y - 0.4, label, '#f6d458'); };
  gpMenu(hlName(g), g, [
    { t: 'В рюкзак', d: `${Game.hero.hero.name} подберёт`, main: true, f: () => send('grab', 'Взять в рюкзак') },
    { t: 'Пусть отнесут на склад', d: 'трудяги заберут', f: () => send('release') },
  ]);
  return true;
}

function gpCoopSlotMenu(i, xy) {
  const s = Coop.me && Coop.me.inv && Coop.me.inv[i];
  if (!s) return;
  const nm = HL_GEAR[s.k] || typeof ITEM_NAME !== 'function' ? hlName(s.k) : ITEM_NAME(s.k), many = s.n > 1 ? ` ×${s.n}` : '';
  const items = [];
  if (HL_FOOD[s.k] || s.k === 'fish') items.push({ t: 'Съесть', d: 'сытость и немного здоровья', main: true, f: () => coopSend({ t: 'use', slot: i }) });
  if (GOODS[s.k]) {
    items.push({ t: 'Положить на землю', d: 'рядом с героем', f: () => coopSend({ t: 'putdown', slot: i }) });
    if (!GOODS[s.k].noStore) items.push({ t: 'Отнести на склад', d: 'герой сам сходит', f: () => coopSend({ t: 'stash', slot: i }) });
  }
  items.push({ t: 'Выбросить насовсем', d: 'вещь пропадёт', f: () => coopSend({ t: 'drop', slot: i }) });
  gpMenu(nm + many, GOODS[s.k] ? s.k : 'bread', items, xy);
}

if (typeof HINTS !== 'undefined') {
  HINTS.gear = { icon: ['good', 'sword'], ref: 't:hero',
    text: 'На земле снаряжение (золотое кольцо)! Коснитесь его: «В руку героя» — подберёт и наденет, «На склад» — унесут трудяги. Вещь в рюкзаке тоже можно нажать: надеть, положить на землю, отнести на склад или выбросить.',
    when: () => gpOn() && [...Game.piles.values()].some(gpHeld) };
}

{
  const st = document.createElement('style');
  st.textContent = `.gp-menu{position:fixed;z-index:60;min-width:190px;max-width:calc(100vw - 16px);padding:6px;display:flex;flex-direction:column;gap:4px;
    background:var(--planks,#3a2a16);border:2px solid #0a0705;box-shadow:inset 0 0 0 1px var(--line-hi,#6a5430),0 4px 10px rgba(0,0,0,.6);border-radius:4px;color:#f6e8c0;font-size:13px}
  .gp-menu .gp-h{display:flex;align-items:center;gap:6px;padding:0 0 2px}
  .gp-menu .gp-h img{width:26px;height:26px;image-rendering:pixelated}.gp-menu .gp-h b{flex:1;color:#f0d27a}
  .gp-menu .gp-x{min-width:36px;min-height:32px}
  .gp-menu .gp-b{display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-height:40px;padding:4px 10px;line-height:1.2}
  .gp-menu .gp-b small{opacity:.75;font-size:11px;font-weight:normal}
  .gp-menu .gp-b.main{border-color:#f6d458;box-shadow:inset 0 0 0 1px #f6d458}
  .gp-tip{opacity:.8}`;
  document.head.appendChild(st);
}
