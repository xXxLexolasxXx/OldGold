'use strict';
// Оружие: особое оружие гильдий, заточка и свойства уровня 3.
// · У каждой гильдии своё особое оружие (светится): клинок воинов, лук лучников, «обмотки» монаха (его учат лучники),
//   клык разбойников, посох магов. Куёт его оружейная для героя (железо и доски из её запасов + золото казны) —
//   сразу, без ожидания. Силой оно выше обычного, а классам своей гильдии подходит целиком.
// · Заточка (в духе Lineage 2, своя реализация): герой точит надетое оружие в оружейной за железо.
//   До +3 — всегда удачно, +4 — 80%, +5 — 60%, +6 — 40%, +7 и дальше — 20%, потолок +12. Неудача уровень НЕ снижает,
//   пропадает только железо. После +5 бонусы заметно растут, но удар по здоровой цели не добивает её с одного раза.
// · Уровень 3 гильдии открывает свойство оружия (вампиризм, паралич, яд, звёздный огонь, тишина монаха). Свойство
//   действует у героя с особым оружием своей гильдии и у рекрутов этой гильдии (в общей деревне — рекруты на сервере).
// Заточка хранится в hero.hero.enh = { k: вид оружия, lv }: если надето другое оружие, уровень не действует.
// Подключается последним: оборачивает heroAtk, neuDamageOf, neuHit, foeHit, killFoe, infoBuilding, durHeroHTML, drawOverlay, drawGoodIcon.

const ENH_MAX = 12, ENH_SAFE = 3;
const ENH_CHANCE = [1, 1, 1, 0.8, 0.6, 0.4, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2];    // шанс перейти с уровня L на L+1: до +3 безопасно, +4 — 80%…
const ENH_DMG = [1, 1.03, 1.06, 1.09, 1.12, 1.15, 1.25, 1.37, 1.5, 1.65, 1.82, 2.0, 2.25];   // урон по нейтралам и врагам
const ENH_ATK = L => L <= 5 ? 0.01 * L : 0.05 + 0.015 * (L - 5);        // прибавка к меткости
const ENH_CAP = 0.4;          // усиленный удар по здоровой (>50%) цели не снимает больше этой доли её здоровья
const enhCost = L => ({ iron: 1 + Math.floor(L / 3) });
const FORGE_COST = { iron: 6, timber: 2 }, FORGE_GOLD = 6;

// особое оружие гильдий: guild — чья, cls — кто носит с полной силой, look — облик в руке (people.js), base — значок-основа
const GW = {
  gwBlade: { guild: 'warrior', cls: ['warrior', 'barbarian', 'paladin'], look: 'sword', base: 'sword', name: 'Клинок Железнобокого', rgb: '255,130,70', hex: '#ff9a60',
    bonus: { str: 6, end: 2 }, atk: 0.26, prop: 'vamp' },
  gwBow: { guild: 'archer', cls: ['archer'], look: 'bow', base: 'bow', name: 'Лунный лук', rgb: '150,205,255', hex: '#a8d8ff',
    bonus: { agi: 7, str: 1 }, atk: 0.25, prop: 'para' },
  gwWraps: { guild: 'archer', cls: ['monk'], look: 'fists', base: null, name: 'Обмотки Тишины', rgb: '255,215,120', hex: '#ffd878',
    bonus: { agi: 5, end: 3 }, atk: 0.24, prop: 'calm' },
  gwFang: { guild: 'rogue', cls: ['rogue', 'bard'], look: 'dagger', base: 'dagger', name: 'Теневой клык', rgb: '190,130,255', hex: '#c8a0ff',
    bonus: { agi: 6, int: 2 }, atk: 0.23, prop: 'venom' },
  gwStaff: { guild: 'mage', cls: ['mage', 'priest', 'druid'], look: 'staff', base: 'staff', name: 'Звёздный посох', rgb: '120,170,255', hex: '#90b8ff',
    bonus: { int: 7 }, atk: 0.25, prop: 'flame' },
};
const GW_PROP = {
  vamp: { name: 'Вампиризм', d: 'каждый удар лечит владельца на 12% нанесённого урона' },
  para: { name: 'Паралич', d: '14% ударов сковывают цель на 2 с' },
  calm: { name: 'Волна тишины', d: '18% ударов оглушают цель на 1,4 с и дают владельцу вдох: +2% здоровья' },
  venom: { name: 'Яд', d: '30% ударов отравляют цель на 5 с' },
  flame: { name: 'Звёздный огонь', d: '30% ударов поджигают цель на 4 с' },
};
const GW_GUILD_NAME = { warrior: 'воинов', archer: 'лучников', rogue: 'разбойников', mage: 'магов' };

if (typeof HL_GEAR !== 'undefined') for (const k in GW) HL_GEAR[k] = { slot: 'weapon', name: GW[k].name };
if (typeof GEAR_BONUS !== 'undefined') for (const k in GW) GEAR_BONUS[k] = Object.assign({}, GW[k].bonus, { atk: GW[k].atk, def: 0 });
if (typeof WPN_LOOK !== 'undefined') for (const k in GW) WPN_LOOK[k] = GW[k].look;
if (typeof DUR !== 'undefined') for (const k in GW) {
  DUR.max[k] = 280; DUR.wear[k] = 0.6; DUR.repair[k] = ['weaponsmith', { iron: 3, timber: 1 }];
}
if (typeof UNLOCK_NAMES !== 'undefined') UNLOCK_NAMES.arms = 'Оружейная';

const arMirror = () => typeof isMirror === 'function' && isMirror();
const arFits = (k, cls) => !!(GW[k] && cls && GW[k].cls.includes(cls));   // подходит ли особое оружие классу
const arGuildB = g => Game.buildings.find(b => isGuild(b) && b.def.guild === g) || null;

// ---------- Заточка ----------

function enhLv(H) { return H && H.enh && H.equip && H.enh.k === H.equip.weapon ? Math.max(0, Math.min(ENH_MAX, H.enh.lv | 0)) : 0; }
const unitEnh = u => (u && u.type === 'hero' && u.hero ? enhLv(u.hero) : 0);
const enhText = L => `урон ×${ENH_DMG[L].toFixed(2).replace('.', ',')}, меткость +${Math.round(ENH_ATK(L) * 1000) / 10}%`;

// ---------- Свойства уровня 3 ----------

function gwProp(u) {
  if (!u || u.dead) return null;
  let k = null, b = null;
  if (u.rec) {
    b = typeof guildOf === 'function' ? guildOf(u) : null;
    k = b && Object.keys(GW).find(x => GW[x].guild === b.def.guild && GW[x].cls.includes(u.rec.cls));
  } else if (u.type === 'hero' && u.hero && u.hero.equip) {
    k = u.hero.equip.weapon;
    if (!arFits(k, typeof unitCls === 'function' ? unitCls(u) : null)) return null;
    b = arGuildB(GW[k].guild);
  }
  return k && b && (b.level || 1) >= 3 ? GW[k].prop : null;
}

function arHeal(u, n) {
  if (u.rec) { if (u.rec.hp != null) u.rec.hp = Math.min(30 + 8 * u.rec.lvl, u.rec.hp + n); return; }
  const H = u.hero;
  if (H && H.maxhp && H.hp > 0) H.hp = Math.min(H.maxhp, H.hp + n);
}

// статус на цели: нейтралы держат настоящие статусы боёвки (combat.js), враги шпиля — упрощённо
function arStatus(N, isFoe, kind, sec, text, col, u) {
  if (!isFoe && typeof cbFxSet === 'function') { cbFxSet(N, kind, sec, u, text, col); return; }
  floater(N.x, N.y - 2.3, text, col);
  if (kind === 'stun') N.cdA = Math.max(N.cdA || 0, sec);
  else if (N.mhp && N.hp > 1) N.hp = Math.max(1, N.hp - N.mhp * (kind === 'burn' ? 0.02 : 0.015));
}

function arProc(u, N, dealt, isFoe) {
  const p = gwProp(u);
  if (!p) return;
  if (p === 'vamp') {
    const n = Math.max(1, dealt * 0.12);
    arHeal(u, u.rec ? n * 0.8 : n);
    if (Math.random() < 0.3) floater(u.x, u.y - 2, '+' + Math.max(1, Math.round(n)), '#ff7a7a');
  } else if (p === 'para' && Math.random() < 0.14) arStatus(N, isFoe, 'stun', 2, 'Паралич!', '#b0d8ff', u);
  else if (p === 'venom' && Math.random() < 0.3) arStatus(N, isFoe, 'bleed', 5, 'Яд!', '#9be070', u);
  else if (p === 'flame' && Math.random() < 0.3) arStatus(N, isFoe, 'burn', 4, 'Горит!', '#ff9a40', u);
  else if (p === 'calm' && Math.random() < 0.18) {
    arStatus(N, isFoe, 'stun', 1.4, 'Тишина…', '#ffe9a0', u);
    if (u.hero && u.hero.maxhp) arHeal(u, u.hero.maxhp * 0.02);
  }
}

// удар по нейтралу или врагу: усиленный заточкой удар не добивает здоровую цель, свойства срабатывают после удара
function arHitWrap(_h, alive, isFoe) {
  return function (N, u, dmg) {
    if (!u || !(u.hero || u.rec) || !alive(N)) return _h(N, u, dmg);
    const L = unitEnh(u), mul = ENH_DMG[L] || 1;
    if (mul > 1 && N.mhp && N.hp >= N.mhp * 0.5) dmg = Math.min(dmg, Math.max(dmg / mul, N.mhp * ENH_CAP));
    const hp0 = N.hp;
    _h(N, u, dmg);
    const dealt = hp0 - Math.max(0, N.hp);
    if (dealt > 0) arProc(u, N, dealt, isFoe);
  };
}
if (typeof neuHit === 'function' && typeof neuAlive === 'function') neuHit = arHitWrap(neuHit, neuAlive, false);
if (typeof foeHit === 'function' && typeof foeLive === 'function') foeHit = arHitWrap(foeHit, foeLive, true);

if (typeof neuDamageOf === 'function') {
  const _nd = neuDamageOf;
  neuDamageOf = function (u) { return _nd(u) * (ENH_DMG[unitEnh(u)] || 1); };
}
if (typeof heroAtk === 'function') {
  const _ha = heroAtk;
  heroAtk = function (u) {
    let p = _ha(u);
    const H = u.hero, w = H && H.equip && H.equip.weapon;
    if (arFits(w, H.clsKey)) p += GW[w].atk * 0.5;                  // своё особое оружие — полная прибавка, у остальных половина
    p += ENH_ATK(unitEnh(u));
    return Math.min(0.95, p);
  };
}
// скелеты, деревья, звери падают с удара: вампиризм лечит и за них
if (typeof killFoe === 'function') {
  const _kf = killFoe;
  killFoe = function (f, u) {
    const was = f && f.kind !== 'foe' && foeAlive(f);
    _kf(f, u);
    if (was && u && gwProp(u) === 'vamp' && !foeAlive(f)) arHeal(u, 3);
  };
}

// ---------- Куём и точим: окно оружейной ----------

const arHero = () => (!arMirror() && Game.hero && Game.hero.hero && typeof hlOn === 'function' && hlOn() ? Game.hero : null);
const arOwns = (H, k) => H.equip.weapon === k || H.inv.some(s => s && s.k === k);
const arIc = k => `<img class="gi" src="${iconURL('good', k, 1)}" alt="" style="width:16px;height:16px;vertical-align:middle;image-rendering:pixelated">`;
const arCostText = c => Object.keys(c).map(g => `${c[g]} ${(GOODS[g].name || g).toLowerCase()}`).join(', ');

function arEnhPanel(b) {
  const h = arHero();
  if (!h) return '';
  const H = h.hero, w = H.equip.weapon;
  let x = '<div class="isec">Заточка оружия</div>';
  if (!w) return x + '<div class="irow small muted">Наденьте оружие — и его можно точить здесь.</div>';
  const L = enhLv(H), nm = hlName(w);
  x += `<div class="irow small">${arIc(w)} <b>${nm}${L ? ' +' + L : ''}</b>${L ? ` · ${enhText(L)}` : ''}</div>`;
  if (L >= ENH_MAX) return x + '<div class="irow small">Предел заточки. Дальше только слава.</div>';
  const cost = enhCost(L), have = durHas(b, cost), pc = Math.round(ENH_CHANCE[L] * 100);
  x += `<div class="irow small">Дальше: <b>+${L + 1}</b> (${enhText(L + 1)}), шанс <b>${pc}%</b>, цена ${arCostText(cost)}</div>`;
  x += `<button class="hp-sm" data-ar="enh:${b.id}" ${have ? '' : 'disabled'} title="${have ? 'Железо берётся из запасов оружейной' : 'В оружейной не хватает: ' + arCostText(cost)}">Заточить</button>`;
  x += `<div class="irow small muted">До +${ENH_SAFE} без риска: +4 — 80%, +5 — 60%, +6 — 40%, +7 и выше — 20%. Неудача уровень не снижает — пропадает только железо. Заточка относится к надетому оружию.</div>`;
  return x;
}

function arForgePanel(b) {
  const h = arHero();
  if (!h) return '';
  const H = h.hero;
  let x = '<div class="isec">Особое оружие гильдий</div>';
  const any = Object.keys(GW).filter(k => arGuildB(GW[k].guild));
  if (!any.length) return x + '<div class="irow small muted">Постройте гильдию — её мастера покажут, чем бьют настоящие мастера. У каждой гильдии своё светящееся оружие.</div>';
  for (const k of any) {
    const G0 = GW[k], g = arGuildB(G0.guild), own = arOwns(H, k), p = GW_PROP[G0.prop], l3 = (g.level || 1) >= 3;
    const cost = Object.assign({}, FORGE_COST), ok = !own && durHas(b, cost);
    x += `<div class="irow small ar-w">${arIc(k)} <span><b>${G0.name}</b> · ${Object.entries(G0.bonus).map(([s, v]) => `${STAT_RU[s]} +${v}`).join(', ')}<br>`
      + `<span class="${l3 ? '' : 'muted'}">${p.name}: ${l3 ? p.d : 'откроется, когда гильдия ' + GW_GUILD_NAME[G0.guild] + ' достроена до 3-го уровня'}</span></span>`
      + (own ? ' <b class="muted">есть у героя</b>' : ` <button class="hp-sm" data-ar="forge:${b.id}:${k}" ${ok ? '' : 'disabled'} title="${ok ? '' : 'Нужно в оружейной: ' + arCostText(cost)}">Выковать</button>`) + '</div>';
  }
  x += `<div class="irow small muted">Цена: ${arCostText(FORGE_COST)} из запасов оружейной и ${FORGE_GOLD} золота из казны. Подходит классам своей гильдии.</div>`;
  return x;
}

{
  const _ib = infoBuilding;
  infoBuilding = function (b) {
    let h = _ib(b);
    if (b.type === 'weaponsmith' && b.state === 'done' && !b.upg && !b.isRoad) {
      const x = arEnhPanel(b) + arForgePanel(b), i = h.lastIndexOf('<div class="idesc">');
      if (x) h = i >= 0 ? h.slice(0, i) + x + h.slice(i) : h + x;
    }
    return h;
  };
}

function arSay(h, text, col) { floater(h.x, h.y - 2, text, col || '#ffe9a0'); toast(text); }

function arEnhance(b) {
  const h = arHero();
  if (!h || !b || b.removed || b.type !== 'weaponsmith' || b.state !== 'done') return;
  const H = h.hero, w = H.equip.weapon;
  if (!w) return;
  const L = enhLv(H);
  if (L >= ENH_MAX) return;
  const cost = enhCost(L);
  if (!durHas(b, cost)) { arSay(h, 'В оружейной не хватает: ' + arCostText(cost), '#e8a070'); return; }
  for (const g in cost) b.stock[g] -= cost[g];
  const win = Math.random() < ENH_CHANCE[L];
  if (win) {
    H.enh = { k: w, lv: L + 1 };
    fxBurst(h.x * TILE, h.y * TILE - 12, 14 + L * 3, ['#ffe070', '#fff6c0', GW[w] ? GW[w].hex : '#ffd040'], 70, 60, 0.9, 1.8, 120);
    sfxAt('chime', h.x * TILE, h.y * TILE);
    arSay(h, `${hlName(w)} +${L + 1}!`, '#ffe070');
    if (L + 1 >= 7) logEvent('people', `${H.name}: ${hlName(w)} заточено до +${L + 1}`, h.x, h.y);
  } else {
    if (!H.enh || H.enh.k !== w) H.enh = { k: w, lv: L };
    fxBurst(h.x * TILE, h.y * TILE - 8, 8, ['#8a8a8a', '#c8c0b0'], 50, 30, 0.6, 1.4, 200);
    sfxAt('thud', h.x * TILE, h.y * TILE, 0.6);
    arSay(h, `Не вышло: ${hlName(w)} остаётся +${L}`, '#ff9a80');
  }
  updateUI(true);
}

function arForge(b, k) {
  const h = arHero(), G0 = GW[k];
  if (!h || !G0 || !b || b.removed || b.type !== 'weaponsmith' || b.state !== 'done') return;
  const H = h.hero, g = arGuildB(G0.guild);
  if (!g) { arSay(h, `Сперва постройте гильдию ${GW_GUILD_NAME[G0.guild]}`, '#e8a070'); return; }
  if (arOwns(H, k)) return;
  if (!durHas(b, FORGE_COST)) { arSay(h, 'В оружейной не хватает: ' + arCostText(FORGE_COST), '#e8a070'); return; }
  if (!H.inv.some(s => !s)) { arSay(h, 'Рюкзак полон', '#e8a070'); return; }
  if (!payGold(g, FORGE_GOLD)) { arSay(h, `Нужно ${FORGE_GOLD} золота в казне`, '#e8a070'); return; }
  for (const c in FORGE_COST) b.stock[c] -= FORGE_COST[c];
  hlAddItem(H, k, 1);
  fxBurst(h.x * TILE, h.y * TILE - 12, 26, ['#fff6c0', G0.hex, '#ffffff'], 90, 60, 1, 2, 120);
  sfxAt('chime', h.x * TILE, h.y * TILE);
  arSay(h, `Выкован: ${G0.name}! Наденьте из рюкзака`, '#ffe070');
  logEvent('people', `${H.name} получил особое оружие: ${G0.name}`, h.x, h.y);
  updateUI(true);
}

// карточка героя: строка про заточку и свойство
if (typeof durHeroHTML === 'function') {
  const _dh = durHeroHTML;
  durHeroHTML = function (H) {
    let x = _dh(H);
    const w = H && H.equip && H.equip.weapon, u = Game.hero;
    if (!w || !u || u.hero !== H) return x;
    const L = enhLv(H), P = GW[w] && gwProp(u) ? GW_PROP[GW[w].prop] : null;
    if (!L && !GW[w]) return x;
    x += `<div class="irow small">${GW[w] ? `<b style="color:${GW[w].hex}">${GW[w].name}</b> · ` : ''}${L ? `заточка <b>+${L}</b>: ${enhText(L)}` : 'без заточки'}${P ? ` · <b>${P.name}</b>` : GW[w] ? ' · <span class="muted">свойство — с 3-го уровня гильдии</span>' : ''}</div>`;
    return x;
  };
}

if (typeof document !== 'undefined') {
  const st = document.createElement('style');
  st.textContent = '.ar-w{display:flex;align-items:center;gap:6px}.ar-w>span{flex:1}';
  document.head.appendChild(st);
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-ar]');
    if (!t || t.disabled) return;
    e.stopPropagation();
    const [a, id, k] = t.dataset.ar.split(':'), b = Game.buildings.find(x => x.id === +id);
    if (a === 'enh') arEnhance(b); else if (a === 'forge') arForge(b, k);
  }, true);
}

// ---------- Значки и свечение ----------

if (typeof drawGoodIcon === 'function') {
  const _dgi = drawGoodIcon;
  drawGoodIcon = function (c, g, x, y) {
    const G0 = GW[g];
    if (!G0) return _dgi(c, g, x, y);
    const P = (a, b, w, h, col) => px(c, x + a, y + b, w, h, col);
    const [r, gg, b2] = G0.rgb.split(',');
    // ореол: полупрозрачные ступени вокруг вещи, потом сама вещь и искры
    P(0, 0, 14, 14, `rgba(${r},${gg},${b2},0.16)`); P(1, 1, 12, 12, `rgba(${r},${gg},${b2},0.22)`);
    if (G0.base) _dgi(c, G0.base, x, y);
    else {
      // обмотки: два кулака в золотых лентах
      P(2, 6, 5, 6, '#e0b890'); P(2, 6, 5, 1, '#f6dcb8'); P(1, 8, 7, 2, '#e8c060'); P(2, 11, 5, 1, '#8a5a30');
      P(8, 4, 5, 6, '#d8a878'); P(8, 4, 5, 1, '#f0cfa0'); P(7, 6, 7, 2, '#e8c060'); P(8, 9, 5, 1, '#8a5a30');
    }
    P(1, 1, 1, 1, '#ffffff'); P(13, 3, 1, 1, '#ffffff'); P(3, 13, 1, 1, G0.hex); P(12, 12, 1, 1, '#ffffff'); P(7, 0, 1, 2, G0.hex);
  };
}

// оружие в руке героя светится: всё особое оружие гильдий, а заточка +7 и выше — слабее; у рекрутов гильдии 3-го уровня — цветом её оружия
if (typeof drawOverlay === 'function') {
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    const t = Game.time;
    for (const u of Game.units) {
      if (u.dead || u.inside) continue;
      let rgb = null, a = 0.45, r = 9;
      if (u.type === 'hero' && u.hero && u.hero.equip) {
        const w = u.hero.equip.weapon, G0 = GW[w];
        if (G0) { rgb = G0.rgb; if (!gwProp(u)) a = 0.35; }
        else if (w && enhLv(u.hero) >= 7) { rgb = '255,225,130'; a = 0.1 + 0.04 * (enhLv(u.hero) - 7); }
        if (rgb && enhLv(u.hero) >= 7) { a += 0.1; r += 2; }
      } else if (u.rec && gwProp(u)) {
        const G0 = Object.values(GW).find(q => q.cls.includes(u.rec.cls));
        if (G0) rgb = G0.rgb;
      }
      if (!rgb) continue;
      const f = u.face || 1, hx = u.x * TILE + f * 7, hy = u.y * TILE - 9, pulse = 0.8 + 0.2 * Math.sin(t * 4 + u.id);
      c.save(); c.globalCompositeOperation = 'lighter';
      glow(c, hx, hy, r * pulse, rgb, a);
      glow(c, hx, hy, r * 0.45, '255,255,255', a * 0.5);
      c.restore();
    }
  };
}
