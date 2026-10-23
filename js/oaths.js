'use strict';
// Клятвы предков (КЛАССЫ.md): у гномов нет «классов», есть старые обеты гильдий, проснувшиеся от проклятия ночи Малгора.
// Класс героя (H.clsKey) и есть его Клятва: дар, цена (минус) и дар деревне — круг вокруг героя, где гномам лучше.
// · Перки по уровням: 3, 6, 9, 12 — +1/+2 к характеристике; 5, 10, 15 — ступени обета (круг шире, эффект сильнее).
// · Цена: скорость, здоровье, точность, железо и доспех, пиво и золото со склада, «дрогнувшая» клятва паладина.
// · Вкладка «Клятва» в карточке героя (herocard.js), Клятвы гильдии в её окне, цитата-тост при принятии.
// В сохранение ничего не добавляется: всё выводится из класса и уровня. Считает хозяин мира (одиночная игра или
// кооп-сервер), клиент общей деревни только рисует. Подключается после herohall.js: все обёртки — поверх чужих.

const OATH_STAT = { str: 'сила', agi: 'ловкость', int: 'смекалка', end: 'стойкость' };
const OATH_PERK_LVL = [3, 6, 9, 12];
const OATH_STEP = 4;                          // секунд между тиками дара деревне
// role — роль в команде; st — перки 3/6/9/12 уровня; mod — цена и дар героя (spd, hp, atk, int); vil — что видит игрок
const OATHS = {
  warrior: { name: 'Клятва Щита', role: 'танк', st: [['end', 2], ['str', 2], ['end', 2], ['str', 2]], mod: { spd: 0.94 },
    quote: 'Стой, где стоишь. Особенно когда все бегут.',
    gift: 'Крепкий: меч и щит с первого урока', price: 'Медленнее на 6%: железо не бегает', vil: 'Ночью гномы рядом спокойнее: «Воин на страже»' },
  barbarian: { name: 'Клятва Бороды', role: 'танк, урон', st: [['str', 2], ['end', 2], ['str', 2], ['end', 2]], mod: { hp: 1.1, int: -3 },
    quote: 'Борода растёт от ярости. Мозги — нет.',
    gift: 'Ярость и +10% здоровья', price: 'Смекалка −3: думает потом, если вообще', vil: 'Гномы рядом не спорят: «Варвар рядом»' },
  paladin: { name: 'Клятва Костра', role: 'танк, лекарь', st: [['end', 2], ['str', 2], ['int', 2], ['end', 2]], mod: { spd: 0.96 },
    quote: 'Пока горит костёр, ты не сдаёшься. Погиб гном — предки спросят с тебя.',
    gift: 'Наложение рук, святой удар, освящение', price: 'Погиб гном — клятва дрожит 4 минуты: приёмы перезаряжаются в полтора раза дольше; медленнее на 4%',
    vil: 'Ночью гномы рядом «Под защитой паладина»; с 10 уровня у них заживают раны' },
  archer: { name: 'Клятва Тропы', role: 'разведчик, урон', st: [['agi', 2], ['str', 1], ['agi', 2], ['agi', 2]], mod: { melee: 0.8 },
    quote: 'Волк знает тебя в лицо. Скелет — тоже, но ему всё равно.',
    gift: 'Бьёт издалека: дальность 7 клеток', price: 'Враг вплотную — попадает на 20% хуже', vil: 'Лесорубы, пастухи и охотники рядом бодрее: «Следопыт показал тропу»' },
  monk: { name: 'Клятва Тишины', role: 'танк-уворот', st: [['agi', 2], ['end', 2], ['agi', 2], ['str', 2]], mod: { spd: 1.06, noArmor: true, dodge: 0.1 },
    quote: 'Доспех — для тех, кто не умеет уворачиваться.',
    gift: 'Быстрее на 6%, уходит от 10% ударов (15% с 15 уровня), шквал ударов', price: 'Доспех не защищает совсем', vil: 'Гномы рядом не срываются и не дерутся: «Монах рядом — тихо»' },
  rogue: { name: 'Клятва Тени', role: 'разведчик, добыча', st: [['agi', 2], ['int', 1], ['agi', 2], ['agi', 2]], mod: { hp: 0.85, coin: true },
    quote: 'Всё, что плохо лежит, теперь лежит у тебя. Включая золото деревни, если деревня грустит.',
    gift: 'Удар в спину; с 5 уровня находит монетки на складе', price: 'Здоровья на 15% меньше; когда деревня тоскует, прикарманивает золото',
    vil: 'Деревне — ничего: плуту не до неё' },
  bard: { name: 'Клятва Песни', role: 'саппорт', st: [['int', 2], ['agi', 2], ['int', 2], ['agi', 2]], mod: { hp: 0.9, atk: 0.9, beer: true },
    quote: 'Драться не умеешь, зато умеешь сделать так, чтобы дрались за тебя. И пили — тоже за тебя.',
    gift: 'Песня бодрости, оглушающий аккорд и «Дай пять!»', price: 'Точность −10%, здоровье −10%; пьёт пиво со склада', vil: 'Гномы рядом веселее: «Бард играет»' },
  mage: { name: 'Клятва Звезды', role: 'урон', st: [['int', 2], ['end', 1], ['int', 2], ['int', 2]], mod: { hp: 0.85 },
    quote: 'Сила звёзд в твоих руках. Здоровье — в чужих.',
    gift: 'Огненный шар, ледяная стрела, щит', price: 'Здоровья на 15% меньше: стекло', vil: 'Фонари, зажжённые магом, горят дольше' },
  priest: { name: 'Клятва Кружки', role: 'лекарь', st: [['int', 2], ['end', 2], ['int', 2], ['end', 2]], mod: { atk: 0.9, faith: true },
    quote: 'Благословляешь пиво, хворых и урожай. Пока в тебя верят. Пока пиво есть.',
    gift: 'Исцеление, снятие болезней, благословение', price: 'Точность −10%; довольная деревня — лечит сильнее, тоскующая — приёмы дольше перезаряжаются',
    vil: 'Хворь у гномов рядом проходит быстрее' },
  druid: { name: 'Клятва Корня', role: 'лекарь, саппорт', st: [['int', 2], ['end', 2], ['int', 2], ['end', 2]], mod: { noIron: true },
    quote: 'Лес тебя слушает. Железо — нет.',
    gift: 'Дикий облик, шипы, Целебное слово', price: 'Железо (меч, секира, железный доспех) не даёт ничего', vil: 'Поля рядом растут быстрее' },
};
const OATH_GUILD_LORE = 'У гномов нет классов — есть Клятвы предков, выбитые под очагом гильдии. Сто лет они спали, пока Малгор из Чёрного шпиля не наслал проклятие ночи. Клятва даёт силу и берёт плату.';
const OATH_IRON = new Set(['sword', 'ironArmor', 'rustySword', 'rustyAxe2']);
const OATH_TRAIL = new Set(['woodcutter', 'herder', 'hunter', 'forager', 'fisher']);
if (typeof MD_WHY !== 'undefined') Object.assign(MD_WHY, {
  oguard: 'Воин на страже', obarb: 'Варвар рядом — не спорим', opal: 'Под защитой паладина', otrail: 'Следопыт показал тропу',
  ocalm: 'Монах рядом — тихо', osong: 'Бард играет',
});
// оружие ученика барда (herokit.js регистрирует своё до нас)
if (typeof KIT_ITEMS !== 'undefined' && KIT_ITEMS.bentRapier) {
  if (typeof HL_GEAR !== 'undefined') HL_GEAR.bentRapier = { slot: 'weapon', name: KIT_ITEMS.bentRapier.name };
  if (typeof GEAR_BONUS !== 'undefined') GEAR_BONUS.bentRapier = Object.assign({}, KIT_ITEMS.bentRapier.bonus, { atk: KIT_ITEMS.bentRapier.atk, def: 0 });
}

const oathOf = H => (H && OATHS[H.clsKey]) || null;
// ступень обета: 0 — до 5 уровня, 1 — с 5, 2 — с 10, 3 — с 15
const oathTier = H => { const l = (H && H.level) || 1; return l >= 15 ? 3 : l >= 10 ? 2 : l >= 5 ? 1 : 0; };
const oathR = H => [5, 6, 8, 10][oathTier(H)];
const oathMul = H => oathTier(H) >= 3 ? 1.5 : 1;
const oathMirror = () => typeof Coop !== 'undefined' && !!Coop.on;

function oathPerkStats(H) {
  const O = oathOf(H), s = { str: 0, agi: 0, int: 0, end: 0 };
  if (!O) return s;
  OATH_PERK_LVL.forEach((l, i) => { if ((H.level || 1) >= l) s[O.st[i][0]] += O.st[i][1]; });
  if (O.mod.int) s.int += O.mod.int;
  return s;
}

// ---------- Дар и цена: обёртки ----------
{
  const _st = heroStats;
  heroStats = function (h) {
    const s = _st(h), O = oathOf(h);
    if (!O) return s;
    const p = oathPerkStats(h);
    for (const k in p) s[k] = Math.max(0, s[k] + p[k]);
    // друид: железо молчит — бонус меча и железного доспеха снимается
    if (O.mod.noIron && h.equip && typeof GEAR_BONUS !== 'undefined') for (const sl of ['weapon', 'armor', 'off']) {
      const k = h.equip[sl], b = OATH_IRON.has(k) && GEAR_BONUS[k];
      if (b) for (const q of ['str', 'agi', 'int', 'end']) if (b[q]) s[q] = Math.max(0, s[q] - b[q]);
    }
    return s;
  };
  if (typeof heroDef === 'function') {
    const _def = heroDef;
    heroDef = function (u) {
      const d = _def(u), H = u && u.hero, O = oathOf(H), a = H && H.equip && H.equip.armor;
      if (!O || !a || typeof GEAR_BONUS === 'undefined' || !GEAR_BONUS[a]) return d;
      if (O.mod.noArmor || (O.mod.noIron && OATH_IRON.has(a))) return Math.max(0, d - (GEAR_BONUS[a].def || 0));
      return d;
    };
  }
  if (typeof heroAtk === 'function') {
    const _atk = heroAtk;
    heroAtk = function (u) {
      let p = _atk(u);
      const O = oathOf(u && u.hero);
      if (!O) return p;
      if (O.mod.atk) p *= O.mod.atk;
      if (O.mod.melee && typeof foesNear === 'function' && foesNear(u.x, u.y, 1.8).length) p *= O.mod.melee;
      return p;
    };
  }
  // монах: доспех не держит, зато уходит от ударов сам
  if (typeof heroDodge === 'function') {
    const _dg = heroDodge;
    heroDodge = function (u) { const O = oathOf(u && u.hero); return O && O.mod.dodge ? Math.min(0.75, _dg(u) + O.mod.dodge * oathMul(u.hero)) : _dg(u); };
  }
  const _spd = teamSpeedMul;
  teamSpeedMul = function (u) {
    const m = _spd(u), h = typeof heroOf === 'function' ? heroOf(u) : null, O = h && oathOf(h.hero);
    return O && O.mod.spd ? m * O.mod.spd : m;
  };
  if (typeof hlMaxHp === 'function') {
    const _hp = hlMaxHp;
    hlMaxHp = function (H) { const O = oathOf(H); return O && O.mod.hp ? Math.round(_hp(H) * O.mod.hp) : _hp(H); };
  }
}

// ---------- Средняя радость деревни (для жреца и плута) ----------
function oathVillageMood() {
  let s = 0, n = 0;
  for (const u of Game.units) if (u.md && !u.dead) { s += u.md.m; n++; }
  return n ? s / n : 50;
}
function oathStore(k, d) {
  // d > 0 — положить на ближайший склад, d < 0 — взять; вернёт, получилось ли
  for (const b of Game.buildings) {
    if (b.removed || !b.isStore || !b.isStore()) continue;
    if (d > 0) { b.stock[k] = (b.stock[k] || 0) + d; return true; }
    if ((b.stock[k] || 0) >= -d) { b.stock[k] += d; return true; }
  }
  return false;
}
function oathSay(h, text) { const o = h.hero && h.hero.owner; if (o && typeof coopSay === 'function' && typeof coop !== 'undefined') coopSay(o, text); else if (!o) toast(text); }

// ---------- Способности: действие Клятвы на гномов, цена паладина и жреца ----------
if (typeof heroAbilityFor === 'function') {
  const _ab = heroAbilityFor;
  heroAbilityFor = function (h, i) {
    const ok = _ab(h, i);
    if (!ok) return ok;
    const H = h.hero, O = oathOf(H), a = heroAbils(H)[i], now = Game.time;
    if (a.oath === 'song' || a.oath === 'five') {
      let n = 0;
      for (const g of Game.units) {
        if (g.dead || g.inside || !g.md || Math.hypot(g.x - h.x, g.y - h.y) > 6) continue;
        if (a.oath === 'song') moodPoke(g, 'osong', 6, 60);
        else if (n < 6) { moodPoke(g, 'five', 8, 90); floater(g.x, g.y - 1.5, 'Пять!', '#ffd070'); n++; }
      }
    }
    if (typeof coopPairAbil === 'function' && H.owner) coopPairAbil(h);
    if (!O) return ok;
    if (O.mod.faith && a.heal) {
      const m = oathVillageMood();
      if (m >= 68) { H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.08); floater(h.x, h.y - 2.4, 'В жреца верят!', '#fff2a0'); }
      else if (m < 38) { H.abCd[a.k] = now + a.cd * 1.3; floater(h.x, h.y - 2.4, 'В жреца не верят…', '#a8b0c0'); }
    }
    if (H.clsKey === 'paladin' && (H.oathCrack || 0) > now) { H.abCd[a.k] = now + a.cd * 1.5; floater(h.x, h.y - 2.4, 'Клятва дрожит', '#c8a070'); }
    if (H.owner) h.abcd = Object.assign({}, H.abCd);
    return ok;
  };
}

// ---------- Дар деревне: раз в OATH_STEP секунд у каждого героя с Клятвой ----------
const OATH = { t: 0, lost: null };
function oathTick() {
  const now = Game.time, night = typeof isNightNow === 'function' && isNightNow();
  // паладин: гном погиб — клятва дрожит
  const lost = Game.lostGnomes || 0, crack = OATH.lost != null && lost > OATH.lost;
  OATH.lost = lost;
  for (const h of Game.units) {
    if (h.type !== 'hero' || !h.hero || h.dead) continue;
    const H = h.hero, O = oathOf(H);
    // принял Клятву (новый класс) — цитата предков; при загрузке молчим
    if (h._oathK !== H.clsKey) {
      if (h._oathK !== undefined && O) { oathSay(h, !H.owner && typeof t === 'function' ? t('{0}: «{1}»', O.name, O.quote) : `${O.name}: «${O.quote}»`); floater(h.x, h.y - 2.4, O.name, (GCLS[H.clsKey] || {}).col || '#ffe070'); }
      h._oathK = H.clsKey;
    }
    if (!O) continue;
    if (crack && H.clsKey === 'paladin') { H.oathCrack = now + 240; floater(h.x, h.y - 2.2, 'Клятва дрогнула!', '#c8a070'); oathSay(h, `${H.name}: погиб гном — Клятва Костра дрожит 4 минуты`); }
    if (h.inside) continue;
    const r = oathR(H), m = oathMul(H), k = H.clsKey, r2 = r * r;
    if (k === 'druid') {
      // поля в круге растут в полтора раза быстрее (×2 на 15 уровне)
      const x0 = Math.floor(h.x), y0 = Math.floor(h.y), add = OATH_STEP / 65 * 0.5 * m;
      for (let y = Math.max(0, y0 - r); y <= Math.min(MAP_H - 1, y0 + r); y++) for (let x = Math.max(0, x0 - r); x <= Math.min(MAP_W - 1, x0 + r); x++) {
        const i = y * MAP_W + x, o = World.obj[i];
        if (o && o.t === 'field' && o.g >= 0 && o.g < 1 && (x - x0) ** 2 + (y - y0) ** 2 <= r2) { o.g = Math.min(1, o.g + add); World.growing.add(i); }
      }
      continue;
    }
    if (O.mod.coin) {
      // плут: монетка или кража — не чаще раза в две минуты
      if (now >= (H.oathCoin || 0)) {
        H.oathCoin = now + 120;
        if (oathVillageMood() < 38) { if (oathStore('gold', -1)) floater(h.x, h.y - 2, '−1 золото: «одолжил»', '#a8b0c0'); }
        else if (oathTier(H) >= 1 && Math.random() < 0.3 * m && oathStore('gold', 1)) floater(h.x, h.y - 2, '+1 золото: нашёл', '#ffe070');
      }
      continue;
    }
    if (O.mod.beer && now >= (H.oathBeer || 0)) {
      H.oathBeer = now + 150;
      if (oathStore('beer', -1)) floater(h.x, h.y - 2, 'Бард промочил горло', '#d8a030');
    }
    for (const g of Game.units) {
      if (g.dead || g.inside || !g.md || g === h) continue;
      const d2 = (g.x - h.x) ** 2 + (g.y - h.y) ** 2;
      if (d2 > r2) continue;
      if (k === 'warrior') { if (night) moodPoke(g, 'oguard', 4 * m, OATH_STEP * 2); }
      else if (k === 'barbarian') moodPoke(g, 'obarb', 3 * m, OATH_STEP * 2);
      else if (k === 'paladin') {
        if (night) moodPoke(g, 'opal', 5 * m, OATH_STEP * 2);
        if (oathTier(H) >= 2 && g.injury && Math.random() < 0.1) { g.injury = null; floater(g.x, g.y - 1.5, 'Зажило!', '#fff0b0'); }
      } else if (k === 'archer') { if (OATH_TRAIL.has(g.type)) moodPoke(g, 'otrail', 4 * m, OATH_STEP * 2); }
      else if (k === 'monk') { moodPoke(g, 'ocalm', 3 * m, OATH_STEP * 2); g.md.cool = Math.max(g.md.cool || 0, now + OATH_STEP * 3); }
      else if (k === 'bard') moodPoke(g, 'osong', 4 * m, OATH_STEP * 2);
      else if (k === 'priest') { if (g.ill && g.ill.s > 0) g.ill.s = Math.max(0, g.ill.s - 0.015 * m); }
    }
  }
}
{
  const _step = step;
  step = function (dt) {
    _step(dt);
    if (oathMirror() || !Game.hero && typeof coop === 'undefined') return;
    OATH.t += dt;
    if (OATH.t >= OATH_STEP) { OATH.t = 0; oathTick(); }
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset.apply(this, arguments); OATH.t = 0; OATH.lost = null; };
}

// ---------- Интерфейс: вкладка «Клятва» и окно гильдии ----------
let oathStyled = false;
function oathStyle() {
  if (oathStyled || typeof document === 'undefined' || !document.head || !document.createElement) return;
  oathStyled = true;
  const st = document.createElement('style');
  st.textContent = '.oath-r{display:block;margin:3px 0;line-height:1.35}.oath-r i{color:#f0e0b0}.oath-q::before{content:"«"}.oath-q::after{content:"»"}';
  document.head.appendChild(st);
}

function oathLine(k) {
  const O = OATHS[k], C = GCLS[k];
  return `<div class="oath-r small"><b style="color:${C.col}">${O.name}</b> <span class="muted">(${C.name.toLowerCase()} · ${O.role})</span>`
    + `<br><span class="muted">дар:</span> <span>${O.gift}</span><br><span class="muted">цена:</span> <span>${O.price}</span></div>`;
}

const OATH_GUILD_RU = { warrior: 'Гильдия воинов', archer: 'Гильдия лучников', rogue: 'Гильдия разбойников', mage: 'Гильдия магов' };
const OATH_ROMAN = ['—', 'I', 'II', 'III'];

function oathTabHTML(H) {
  oathStyle();
  const O = oathOf(H), C = O && GCLS[H.clsKey];
  if (!O) {
    const by = {};
    for (const k in OATHS) { const g = (GCLS[k] && (GCLS[k].guild || k)) || k; (by[g] || (by[g] = [])).push(k); }
    return `<div class="oath-r small">${OATH_GUILD_LORE}</div><div class="oath-r small muted">Клятвы ещё нет — примите её у главы гильдии.</div>`
      + Object.entries(by).map(([g, ks]) => `<div class="oath-r small"><span>${OATH_GUILD_RU[g] || g}</span>: ${ks.map(k => `<b style="color:${GCLS[k].col}">${OATHS[k].name}</b>`).join(', ')}</div>`).join('');
  }
  const lv = H.level || 1, tier = oathTier(H), now = Game.time;
  // перк — [уровень, имя жирным (может быть пустым), текст, добавка по классу]
  const perks = [[1, O.name, `: дар и цена, круг ${oathR({ level: 1 })} клеток`, '']];
  OATH_PERK_LVL.forEach((l, i) => perks.push([l, '', `${OATH_STAT[O.st[i][0]]} +${O.st[i][1]}`, '']));
  perks.push([5, '', 'Обет I: круг 6 клеток', H.clsKey === 'rogue' ? 'находит монетки' : ''], [10, '', 'Обет II: круг 8 клеток', H.clsKey === 'paladin' ? 'раны гномов заживают' : ''], [15, '', 'Обет III: круг 10 клеток', 'дар деревне ×1,5']);
  perks.sort((a, b) => a[0] - b[0]);
  const crack = H.clsKey === 'paladin' && (H.oathCrack || 0) > now ? `<div class="oath-r small warn">Клятва дрожит ещё ${Math.ceil(H.oathCrack - now)} с: погиб гном</div>` : '';
  return `<div class="oath-r"><b style="color:${C.col}">${O.name}</b> <span class="muted small">(${O.role})</span></div>`
    + `<div class="oath-r small"><i class="oath-q">${O.quote}</i></div>${crack}`
    + `<div class="oath-r small"><span class="muted">Дар:</span> <span>${O.gift}</span></div>`
    + `<div class="oath-r small"><span class="muted">Цена:</span> <span>${O.price}</span></div>`
    + `<div class="oath-r small"><span class="muted">Деревне:</span> <span>${O.vil}</span> <span class="muted">(круг ${oathR(H)} клеток, обет ${OATH_ROMAN[tier]})</span></div>`
    + `<div class="oath-r small muted">Перки по уровням</div>`
    + perks.map(([l, nm, t, x]) => `<div class="oath-r small${lv >= l ? '' : ' muted'}">${lv >= l ? '✓' : '·'} <b>${l}</b> · ${nm ? `<b>${nm}</b>` : ''}<span>${t}</span>${x ? `<span>, ${x}</span>` : ''}</div>`).join('');
}

if (typeof guildHTML === 'function') {
  const _gh = guildHTML;
  guildHTML = function (b) {
    const x = _gh(b), g = b && b.def && b.def.guild;
    if (!g || typeof guildClasses !== 'function') return x;
    const ks = guildClasses(g).filter(k => OATHS[k]);
    oathStyle();
    return x + `<div class="isec">Клятвы гильдии</div><div class="tip small">${OATH_GUILD_LORE}</div>` + ks.map(oathLine).join('');
  };
}
