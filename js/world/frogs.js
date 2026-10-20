'use strict';
// Жаболюды / жаболюды (ЖАБОЛЮДЫ.md): нейтральный народ у воды, четыре касты — зелёные копейщики (ftG), синие охотники (ftB),
// фиолетовые шаманы (ftP), золотой вождь (ftK). Лор D&D (грунги) взят как вдохновение механик:
//   земноводные — влажность и лечение водой, ядовитая кожа и дротики, прыжок с места через стены, лазанье по деревьям,
//   стая зовёт своих, шаманы лечат и напускают туман, зимой — спячка, огонь и сухость — слабость; дети не страдают.
// Фиолетовые — маги электричества (молния), красные — маги огня (огненный шар).
// Всё считает симуляция (в кооперативе — сервер); клиенту в зеркало идут wet, pch, dart, fg, tor.
// Подключается после neutrals2.js; чужие файлы не правятся — только обёртки (neuThink, neuHit, neuStrike, neuDraw…).

const FT_KINDS = { ftG: 1, ftB: 1, ftP: 1, ftR: 1, ftK: 1 };
const FT = { rng: null, sec: 0, q: 0, t5: 0, mul: 1, src: null, hinted: false, hint0: 0 };
const ftRand = () => (FT.rng || (FT.rng = mulberry32(0x7F0A91)))();
const ftIs = N => !!(N && FT_KINDS[N.k]);
const ftNow = () => Game.time;
const ftKid = u => !!u && u.type === 'kid';
const ftWinter = () => (typeof isWinter === 'function' && isWinter()) || (typeof SEA === 'function' && SEA().snow > 0.6);
const ftSummer = () => typeof seaIdx === 'function' && seaIdx() === 0;
const FT_LAIR = 'ftvil';
const FT_CALL_R = 18;            // кваканье шамана слышно на столько клеток
const FT_TERR_R = 4.5;           // территория поселения

// ---------- Виды, логово, товары ----------
if (typeof NSPEC !== 'undefined') {
  Object.assign(NSPEC, {
    ftG: { name: 'Жаболюд-копейщик', mhp: 34, dmg: [4, 6], cd: 1.4, rng: 1.6, spd: 2.6, parry: 0.18, xp: 30, roam: 3, sz: 9,
      drop: [['hide', 1, 0.6], ['venom', 1, 0.5], ['slime', 1, 0.5]], msg: ['Ква! Прочь с болота!', 'Ква-ква-ква!', 'Чужак! Квак!'] },
    ftB: { name: 'Жаболюд-охотник', mhp: 26, dmg: [3, 5], cd: 1.8, rng: 5, spd: 2.5, parry: 0.2, xp: 36, roam: 3.4, sz: 8, ranged: true,
      drop: [['hide', 1, 0.5], ['venom', 2, 0.8], ['slime', 1, 0.3]], msg: ['Дротик — в цель!', 'Тсс… ква.', 'Мои дротики голодны!'] },
    ftP: { name: 'Жаболюд-громовик', mhp: 32, dmg: [3, 5], cd: 2.0, rng: 4, spd: 2.0, parry: 0.22, xp: 60, roam: 2.6, sz: 9, ranged: true,
      drop: [['venom', 2, 0.8], ['slime', 2, 0.7], ['magicstone', 1, 0.5], ['mana', 1, 0.3]], msg: ['Гром над болотом!', 'Ква-а-а… молния, приди!', 'Вода и гроза — наши сёстры!'] },
    ftR: { name: 'Жаболюд-огнемаг', mhp: 30, dmg: [4, 7], cd: 2.1, rng: 4.5, spd: 2.0, parry: 0.15, xp: 55, roam: 2.6, sz: 9, ranged: true,
      drop: [['ash', 1, 0.6], ['slime', 1, 0.5], ['magicstone', 1, 0.5], ['venom', 1, 0.5]], msg: ['Гори, гори ясно!', 'Ква-а-а… пламя, явись!', 'Болотные огни — со мной!'] },
    ftK: { name: 'Вождь жаболюдов', mhp: 105, dmg: [7, 10], cd: 1.9, rng: 1.9, spd: 2.3, parry: 0.12, xp: 140, roam: 2.4, sz: 13,
      drop: [['venom', 3, 1], ['gold', 3, 0.9], ['slime', 2, 0.8], ['hide', 2, 0.6]], msg: ['КВАААК! Вся деревня — на чужака!', 'Я — вождь болота!', 'Ква-ква-КВА!'] },
  });
  NLAIR[FT_LAIR] = ['ftG', 'ftG', 'ftG', 'ftB', 'ftB', 'ftP'];
  NEU_LAIR_NAME[FT_LAIR] = 'Свайная деревня жаболюдов';
}
if (typeof CB_WEAK !== 'undefined') Object.assign(CB_WEAK, {
  ftG: { fire: 1.8, steel: 1.1, pierce: 1.1, nature: 0.7 },
  ftB: { fire: 1.8, steel: 1.2, blunt: 1.1, nature: 0.7 },
  ftP: { fire: 1.8, holy: 1.2, steel: 1.2, nature: 0.6 },
  ftR: { fire: 0.4, holy: 1.2, steel: 1.2, pierce: 1.2, nature: 0.8 },
  ftK: { fire: 1.5, holy: 1.1, nature: 0.7, steel: 0.9 },
});
if (typeof N2_TOP !== 'undefined') Object.assign(N2_TOP, { ftG: 40, ftB: 40, ftP: 50, ftR: 50, ftK: 58 });

// новые товары: яд и слизь (аптека варит из яда зелья, торговцы берут)
GOODS.venom = { name: 'Яд жаболюдов', color: '#7ad030', group: 'Магия' };
GOODS.slime = { name: 'Болотная слизь', color: '#8ad0a8', group: 'Ремесло' };
for (const g of ['venom', 'slime']) if (!GOOD_KEYS.includes(g)) GOOD_KEYS.push(g);
if (typeof TR_BASE !== 'undefined') {
  TR_BASE.venom = 5; TR_BASE.slime = 2.5;
  TR_GROUPS.wander.sells.push('slime'); TR_GROUPS.mage.sells.push('venom'); TR_GROUPS.mage.wants.push('slime');
  TR_GROUPS.farm.wants.push('slime'); TR_GROUPS.wander.wants.push('venom');
}
if (typeof TR_EVENTS !== 'undefined') TR_EVENTS.push({ id: 'swampfever', name: 'Болотная лихорадка', goods: ['venom', 'potion', 'slime'], f: 1.4, text: 'Болотная лихорадка: яд, слизь и зелья в цене' });
if (typeof BUILDINGS !== 'undefined' && BUILDINGS.infirmary) {
  BUILDINGS.infirmary.inputs = Object.assign({}, BUILDINGS.infirmary.inputs, { venom: 4 });
  BUILDINGS.infirmary.recipes.push({ in: { venom: 1, hops: 1 }, out: { potion: 3 }, time: 12 });
}
if (typeof drawGoodIcon === 'function') {
  const _gi = drawGoodIcon;
  drawGoodIcon = function (c, g, x, y) {
    if (g !== 'venom' && g !== 'slime') return _gi(c, g, x, y);
    const P = (a, b, w, h, col) => px(c, x + a, y + b, w, h, col);
    if (g === 'venom') { P(6, 2, 4, 2, '#8a6a3a'); P(5, 4, 6, 1, '#e8e0c8'); P(3, 5, 10, 9, '#e8e0c8'); P(4, 7, 8, 6, '#7ad030'); P(5, 7, 2, 2, '#c8f870'); P(9, 10, 2, 2, '#4a9a1a'); }
    else { P(3, 8, 10, 6, '#8ad0a8'); P(4, 6, 8, 3, '#8ad0a8'); P(6, 4, 4, 3, '#8ad0a8'); P(5, 7, 2, 2, '#d8fff0'); P(9, 11, 3, 2, '#5aa078'); P(7, 13, 2, 2, '#8ad0a8'); }
  };
}

// ---------- Вода, влажность ----------
// у логова свой пруд (нарисован в деревне), поэтому «вода» — и он, и настоящий берег рядом: список берега кэшируется на логово
function ftShore(L) {
  const M = Game.ftw || (Game.ftw = new Map());
  let a = M.get(L.id);
  if (a) return a;
  a = [];
  const wat = (x, y) => inb(x, y) && World.terrain[idx(x, y)] === T_WATER;
  for (let y = L.y - 12; y <= L.y + 12; y++) for (let x = L.x - 12; x <= L.x + 12; x++) {
    if (!wat(x, y)) continue;
    if (!wat(x - 1, y) || !wat(x + 1, y) || !wat(x, y - 1) || !wat(x, y + 1)) a.push([x + 0.5, y + 0.5]);
  }
  if (a.length > 90) { const s = Math.ceil(a.length / 90); a = a.filter((_, i) => i % s === 0); }
  M.set(L.id, a);
  return a;
}
function ftWaterDist(N) {
  const L = Game.lairs.find(l => l.id === N.lair);
  if (!L) return 0;
  let d = Math.hypot(N.x - (L.x + 0.5), N.y - (L.y + 0.9)) - 1.6;           // свой пруд деревни
  for (const [x, y] of ftShore(L)) { const e = Math.hypot(N.x - x, N.y - y); if (e < d) d = e; }
  return Math.max(0, d);
}
const ftWaterNear = (x, y, r) => { for (let yy = Math.floor(y - r); yy <= Math.floor(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.floor(x + r); xx++) if (inb(xx, yy) && World.terrain[idx(xx, yy)] === T_WATER && Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r) return true; return false; };

// ---------- Жизнь: влажность, лечение, спячка ----------
function ftLife(N, dt) {
  if (N.wet === undefined) N.wet = 1;
  N.wdT = (N.wdT || 0) - dt;
  if (N.wdT <= 0 || N.wd === undefined) { N.wdT = 0.5; N.wd = ftWaterDist(N); }
  const frozen = ftWinter(), rain = typeof isRaining === 'function' && isRaining(), burn = typeof cbOn === 'function' && cbOn(N, 'burn');
  if (N.wd <= 2.4 && !frozen) {
    N.wet = Math.min(1, N.wet + 0.12 * dt);
    if (N.hp < N.mhp) N.hp = Math.min(N.mhp, N.hp + N.mhp * 0.02 * dt);       // водой лечатся
  } else if (N.wd > 6) {
    const heat = Math.max(0.3, 1 + (ftSummer() && !(typeof isNightNow === 'function' && isNightNow()) && !rain ? 0.6 : 0) - (rain ? 0.7 : 0));
    N.wet = Math.max(0, N.wet - dt / 90 * heat);
  }
  if (rain) N.wet = Math.min(1, N.wet + 0.04 * dt);
  if (burn) N.wet = Math.max(0, N.wet - 0.25 * dt);
  if (N.wet <= 0 && N.hp > N.mhp * 0.15) {
    N.hp = Math.max(N.mhp * 0.15, N.hp - N.mhp * 0.006 * dt);
    N.drySay = (N.drySay || 0) - dt;
    if (N.drySay <= 0) { N.drySay = 6; floater(N.x, N.y - 2, 'Пересох!', '#e0c870'); }
  }
}

// ---------- Прыжок с места ----------
function ftLeap(N, tx, ty, o) {
  o = o || {};
  let X = tx, Y = ty;
  if (!o.perch && !isWalkable(Math.floor(X), Math.floor(Y))) {
    const s = randomFreeNear(Math.floor(X), Math.floor(Y), 0, 2, (x, y) => isWalkable(x, y));
    if (!s) return false;
    X = s[0] + 0.5; Y = s[1] + 0.5;
  }
  const d = Math.hypot(X - N.x, Y - N.y);
  if (d < 1.3 || d > 9.5) return false;
  N.jp = { ph: 'crouch', t: 0, sx: N.x, sy: N.y, tx: X, ty: Y, dur: Math.min(0.62, 0.3 + d * 0.04), strike: !!o.strike, perch: !!o.perch };
  N.st = 'jump'; N.face = X >= N.x ? 1 : -1; N.atkT = 9; N.tel = null; N.pch = null; N.ov = null;
  return true;
}

function ftJumpThink(N, dt) {
  const J = N.jp, S = NSPEC[N.k];
  J.t += dt;
  if (J.ph === 'crouch') {
    N.fr = J.t < 0.08 ? 'j0' : 'j1';
    if (J.t >= 0.16) { J.ph = 'air'; J.t = 0; sfxAt('ftJump', N.x * TILE, N.y * TILE, 0.7); }
    return;
  }
  if (J.ph === 'air') {
    const p = Math.min(1, J.t / J.dur);
    N.x = J.sx + (J.tx - J.sx) * p; N.y = J.sy + (J.ty - J.sy) * p;
    N.fr = p < 0.22 ? 'j2' : p < 0.5 ? 'j3' : p < 0.72 ? 'j4' : 'j5';
    if (p >= 1) {
      J.ph = 'land'; J.t = 0; N.x = J.tx; N.y = J.ty;
      if (J.perch) { N.pch = { x: N.x, y: N.y, until: ftNow() + 22 + ftRand() * 22 }; sfxAt('frogHop', N.x * TILE, N.y * TILE, 0.5); }
      else {
        if (ftWaterNear(N.x, N.y, 2.2)) { sfxAt('ftSplash', N.x * TILE, N.y * TILE, 0.6); fxBurst(N.x * TILE, N.y * TILE - 4, 8, ['#cfeaf0', '#8ac8d8'], 45, 40, 0.5, 1.4, 140); }
        else fxBurst(N.x * TILE, N.y * TILE - 2, 6, ['#a89870', '#d8c8a0'], 40, 30, 0.4, 1.3, 160);
        const tg = neuUnit(N.tg);
        if (J.strike && tg && !neuUnitOut(tg) && !ftKid(tg) && Math.hypot(tg.x - N.x, tg.y - N.y) <= S.rng + 1.1) {
          if (tg.hero && tg.hero.rollT > ftNow()) floater(tg.x, tg.y - 1.9, 'Перекат!', '#cfe8ff');
          else { const m = FT.mul; FT.mul = m * 1.25; try { neuStrike(N, tg); } finally { FT.mul = m; } }
          N.cdA = Math.max(N.cdA, 0.7);
        }
      }
    }
    return;
  }
  N.fr = J.t < 0.1 ? 'j6' : 'j7';
  if (J.t >= 0.2) {
    N.jp = null;
    N.st = N.pch ? 'idle' : neuUnit(N.tg) ? 'chase' : 'home';
    if (N.st === 'chase') N.dist = 99;
  }
}

// ---------- Мысль жаболюда ----------
{
  const _th = neuThink;
  neuThink = function (N, dt) {
    if (!ftIs(N)) return _th(N, dt);
    if (N.st === 'die') { N.jp = null; N.pch = null; N.tor = 0; return _th(N, dt); }
    const S = NSPEC[N.k], now = ftNow(), winter = ftWinter();
    ftLife(N, dt);
    if (N.ov) N.ovT += dt;
    if (N.jp) { N.cdA -= dt; ftJumpThink(N, dt); return; }
    let tg = neuUnit(N.tg);
    if (tg && (ftKid(tg) || neuUnitOut(tg))) { N.tg = 0; tg = null; }
    // оцепенение: тронули зимой — просыпаются вялыми
    N.cold = winter && !!(tg || now - N.prov < NEU_FORGET);
    // ---- спячка у воды ----
    if (winter && !tg && !(now - N.prov < NEU_FORGET) && !N.winT) {
      const home = Math.hypot(N.x - N.hx, N.y - N.hy);
      if (home > 1.8 && !N.tor) { N.st = 'home'; _th(N, dt); return; }
      N.tor = 1; N.st = 'idle'; N.pat = 0; N.tg = 0;
      N.fr = Math.floor(now * 0.8 + N.id) % 2 ? 'z1' : 'z0';
      return;
    }
    if (N.tor) { N.tor = 0; N.st = 'idle'; if (N.cold) floater(N.x, N.y - 2, 'Замёрз…', '#bfe0ff'); }
    // ---- на дереве: стреляют сверху, подальше достают ----
    if (N.pch) {
      N.x = N.pch.x; N.y = N.pch.y;
      if (!tg && now > N.pch.until) { ftLeap(N, N.hx + (ftRand() - 0.5) * 3, N.hy + 1 + ftRand() * 1.5); if (N.jp) { N.pch = null; return; } N.pch = null; }
      else if (tg) {
        const d = Math.hypot(tg.x - N.x, tg.y - N.y);
        if (d > S.rng + 1.4 || d < 1.8) { const sp = N.pch; N.pch = null; if (!ftLeap(N, tg.x - (tg.x - sp.x) / (d || 1) * 1.6, tg.y - (tg.y - sp.y) / (d || 1) * 1.6, { strike: true })) N.pch = sp; else return; }
        else {
          const r0 = S.rng; S.rng = r0 + 1.2;
          try { _th(N, dt * (N.cold ? 0.5 : 1)); } finally { S.rng = r0; }
          N.x = N.pch.x; N.y = N.pch.y;
          if (N.st === 'chase') N.st = 'atk';
          ftAfter(N, tg);
          return;
        }
      } else { N.st = 'idle'; N.fr = 'i' + (Math.floor(now * 5 + N.id) % 6); return; }
    }
    // ---- высохли: бросают погоню и прыжком к воде ----
    if (tg && N.wet < 0.25 && !N.cold) {
      N.tgMem = N.tg; N.tg = 0; N.st = 'home'; tg = null;
      floater(N.x, N.y - 2.2, 'Кожа сохнет! К воде!', '#e0c870');
      if (N.wd > 5 && !(N.jpCd > now)) { const L = Game.lairs.find(l => l.id === N.lair); if (L) { N.jpCd = now + 3; const a = Math.atan2(L.y + 0.5 - N.y, L.x + 0.5 - N.x), r = Math.min(8, Math.hypot(L.x + 0.5 - N.x, L.y + 0.5 - N.y) - 1.5); ftLeap(N, N.x + Math.cos(a) * r, N.y + Math.sin(a) * r, { home: true }); if (N.jp) return; } }
    }
    if (!tg && N.tgMem && N.wet > 0.7 && now - N.prov < NEU_FORGET) { const u = neuUnit(N.tgMem); if (u && !neuUnitOut(u)) { N.tg = N.tgMem; tg = u; } N.tgMem = 0; }
    // ---- прыжок в бой ----
    if (tg && N.st !== 'atk' && !(N.jpCd > now) && !N.cold && !(typeof cbOn === 'function' && cbOn(N, 'stun')) && !neuUnitOut(tg)) {
      const d = Math.hypot(tg.x - N.x, tg.y - N.y), far = Math.hypot(N.x - N.hx, N.y - N.hy) < NEU_LEASH - 3;
      if ((N.k === 'ftG' || N.k === 'ftK') && d > 3 && d < (N.k === 'ftK' ? 9 : 7.5) && far && N.wet > 0.35) {
        N.jpCd = now + 3.2 + ftRand() * 2;
        if (ftLeap(N, tg.x - (tg.x - N.x) / d * 1.1, tg.y - (tg.y - N.y) / d * 1.1, { strike: true })) { sfxAt('ftCroak', N.x * TILE, N.y * TILE, 0.4); return; }
      } else if (N.k === 'ftB' && d < 2.2 && far) {                 // охотник отпрыгивает от ближнего боя
        N.jpCd = now + 4 + ftRand() * 2;
        const a = Math.atan2(N.y - tg.y, N.x - tg.x) + (ftRand() - 0.5) * 0.8;
        if (ftLeap(N, N.x + Math.cos(a) * 5, N.y + Math.sin(a) * 5)) return;
      } else if (N.stuck > 0.4 && d > 2) {                          // перед стеной/постройкой: перепрыгнуть
        N.jpCd = now + 3; N.stuck = 0;
        if (ftLeap(N, tg.x - (tg.x - N.x) / d * 1.4, tg.y - (tg.y - N.y) / d * 1.4, { strike: true })) return;
      }
    }
    // ---- охотник забирается на дерево (засада) ----
    if (N.k === 'ftB' && !tg && N.st === 'idle' && !winter && !(now - N.prov < NEU_FORGET) && !(N.pchCd > now) && !N.winT) {
      N.pchCd = now + 25 + ftRand() * 30;
      const tr = ftTreeNear(N.x, N.y, 3.6);
      if (tr && ftRand() < 0.6) { ftLeap(N, tr[0] + 0.5, tr[1] + 0.55, { perch: true }); if (N.jp) return; }
    }
    // ---- обычное поведение ----
    const dtT = N.cold ? dt * 0.5 : dt;
    _th(N, dtT);
    if (N.st === 'die') return;
    // патруль жаболюдов короче: к воде поближе
    if (N.pat === 1 && Math.hypot(N.wx - N.hx, N.wy - N.hy) > 7) { const a = Math.atan2(N.wy - N.hy, N.wx - N.hx); N.wx = N.hx + Math.cos(a) * 7; N.wy = N.hy + Math.sin(a) * 7; }
    ftAfter(N, tg);
    // маги не машут посохом: любая их атака — каст с огоньком/молнией на расстоянии (кадры c0…c5, пик на 0,24 с)
    if ((N.k === 'ftP' || N.k === 'ftR') && N.st === 'atk' && N.atkT === 0 && tg) { N.ov = NA_FRAMES.cast; N.ovT = 0; N.ovP = 0.08; N.fr = 'c0'; }
    // ближний бой дротика: охотник у цели на дистанции ≥3,5 дует из трубки (6 кадров)
    if (N.k === 'ftB' && N.st === 'atk' && N.atkT === 0 && tg) {
      if (Math.hypot(tg.x - N.x, tg.y - N.y) >= 3.5) { N.ov = NA_FRAMES.throwd; N.ovT = 0; N.ovP = 0.08; N.fr = 't0'; }
    }
  };
}
function ftTreeNear(x, y, r) {
  let best = null, bd = 99;
  for (let yy = Math.floor(y - r); yy <= Math.floor(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.floor(x + r); xx++) {
    if (!inb(xx, yy)) continue;
    const o = World.obj[idx(xx, yy)];
    if (!o || o.t !== 'tree') continue;
    const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
    if (d >= 1.3 && d < bd && !Game.neutrals.some(M => M.pch && Math.floor(M.pch.x) === xx && Math.floor(M.pch.y) === yy)) { bd = d; best = [xx, yy]; }
  }
  return best;
}

// шаманы и вождь: умения в бою
function ftShock(N, u) {
  const m = FT.mul, s0 = FT.src; FT.mul = 1; FT.src = null;
  try { neuHurtUnit(u, neuR(5, 8) * (1 + 0.25 * ((N.rk || 1) - 1)) * dif().neuDmg); } finally { FT.mul = m; FT.src = s0; }
  u.fgUntil = ftNow() + 2.2; u.ouchUntil = ftNow() + 0.5;
  if (u.hero && u.hero.hp <= 0) neuHeroDown(N, u);
}
function ftAfter(N, tg) {
  const now = ftNow();
  if (!tg || N.st === 'die' || N.jp || (typeof cbOn === 'function' && cbOn(N, 'stun')) || N.cold) return;
  if (N.k === 'ftP' && !(N.abT > now) && N.st !== 'atk') {
    N.abT = now + 5 + ftRand() * 2;
    // 1) лечение раненого соплеменника
    let low = null;
    for (const M of Game.neutrals) if (M !== N && neuAlive(M) && ftIs(M) && M.hp < M.mhp * 0.6 && Math.hypot(M.x - N.x, M.y - N.y) < 7 && (!low || M.hp / M.mhp < low.hp / low.mhp)) low = M;
    if (low) {
      const h = Math.round(low.mhp * 0.22); low.hp = Math.min(low.mhp, low.hp + h);
      N.ov = NA_FRAMES.cast; N.ovT = 0; N.ovP = 0.13; N.face = low.x >= N.x ? 1 : -1;
      fxBurst(low.x * TILE, low.y * TILE - 14, 14, ['#9af0a0', '#d8ffd8', '#ffe070'], 60, 60, 0.9, 1.6, -30);
      floater(low.x, low.y - 2, '+' + h, '#8af070'); floater(N.x, N.y - 2.3, 'Водное исцеление', '#9af0a0');
      sfxAt('ftHeal', low.x * TILE, low.y * TILE, 0.8);
      return;
    }
    // 2) зов: всех свободных жаболюдов в 18 клетках — в бой
    if (!(N.callT > now)) {
      let n = 0;
      for (const M of Game.neutrals) if (M !== N && neuAlive(M) && ftIs(M) && !M.tg && !M.tor && Math.hypot(M.x - N.x, M.y - N.y) < FT_CALL_R) { M.tg = tg.id; M.prov = now; M.cdA = 0.4 + ftRand() * 0.8; M.pat = 0; n++; }
      if (n) {
        N.callT = now + 30;
        N.ov = NA_FRAMES.cast; N.ovT = 0; N.ovP = 0.13;
        floater(N.x, N.y - 2.5, 'Ква-а-а-а-а!', '#c8a0ff'); sfxAt('ftCroak', N.x * TILE, N.y * TILE, 1);
        logEvent('animal', `Шаман жаболюдов созвал соседей на помощь (${n})`, N.x, N.y);
        return;
      }
    }
    // 3) молния: бьёт цель и цепью — тех, кто рядом; оглушает (замедляет) на пару секунд
    if (!(N.zapT > now)) {
      N.zapT = now + 9;
      N.ov = NA_FRAMES.cast; N.ovT = 0; N.ovP = 0.13; N.face = tg.x >= N.x ? 1 : -1;
      const pts = [[tg.x, tg.y]]; let n = 0;
      for (const u of Game.units) {
        if (u === tg || u.dead || u.inside || ftKid(u) || !(u.hero || u.rec || isPerson(u)) || Math.hypot(u.x - tg.x, u.y - tg.y) > 2.6) continue;
        if (n++ >= 2) break;
        pts.push([u.x, u.y]);
        ftShock(N, u);
      }
      ftShock(N, tg);
      N.zap = { t: Math.round(now * 100) / 100, p: pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]) };
      floater(N.x, N.y - 2.4, 'Молния!', '#bfe8ff'); sfxAt('ftZap', tg.x * TILE, tg.y * TILE, 1);
      fxBurst(tg.x * TILE, tg.y * TILE - 12, 14, ['#ffffff', '#9ae0ff', '#ffffa0'], 80, 60, 0.5, 1.6, 100);
    }
  }
  if (N.k === 'ftR' && !(N.abT > now) && N.st !== 'atk') {
    N.abT = now + 7 + ftRand() * 3;
    N.ov = NA_FRAMES.cast; N.ovT = 0; N.ovP = 0.13; N.face = tg.x >= N.x ? 1 : -1;
    N.dart = { x: Math.round(tg.x * 100) / 100, y: Math.round(tg.y * 100) / 100, t: Math.round(now * 100) / 100, o: 2 };
    floater(N.x, N.y - 2.4, 'Огненный шар!', '#ffb050'); sfxAt('ftFire', N.x * TILE, N.y * TILE, 1);
    for (const u of Game.units) {
      if (u.dead || u.inside || ftKid(u) || !(u.hero || u.rec || isPerson(u)) || Math.hypot(u.x - tg.x, u.y - tg.y) > 2) continue;
      const m = FT.mul, s0 = FT.src; FT.mul = 1; FT.src = null;
      try { neuHurtUnit(u, neuR(6, 9) * (1 + 0.25 * ((N.rk || 1) - 1)) * dif().neuDmg); } finally { FT.mul = m; FT.src = s0; }
      u.brnUntil = now + 4; u.ouchUntil = now + 0.5;
      if (u.hero && u.hero.hp <= 0) neuHeroDown(N, u);
    }
    fxBurst(tg.x * TILE, tg.y * TILE - 8, 26, ['#fff0a0', '#ff9a30', '#e04a18'], 100, 70, 0.8, 2.2, 140);
    floater(tg.x, tg.y - 2, 'Горит!', '#ff9a40');
  }
  if (N.k === 'ftK' && !N.cried && N.st !== 'atk' && (N.hp < N.mhp * 0.9 || Math.hypot(tg.x - N.x, tg.y - N.y) < 6)) {
    N.cried = now;
    N.ov = NA_FRAMES.cast; N.ovT = 0; N.ovP = 0.13;
    let n = 0;
    for (const M of Game.neutrals) if (neuAlive(M) && ftIs(M) && Math.hypot(M.x - N.x, M.y - N.y) < 8) { M.rage = now + 10; n++; }
    floater(N.x, N.y - 3, 'Боевой клич!', '#ffd040'); sfxAt('ftCroakLow', N.x * TILE, N.y * TILE, 1);
    fxBurst(N.x * TILE, N.y * TILE - 20, 16, ['#ffd040', '#fff0a0', '#e84a38'], 70, 60, 0.9, 1.8, -20);
    if (n > 1) logEvent('animal', 'Вождь жаболюдов издал боевой клич', N.x, N.y);
  }
  if (N.k === 'ftK' && N.cried && now - N.cried > 40 && !tg) N.cried = 0;
}

// ---------- Урон, зов, яд, удары ----------
function ftPoison(u, N, dur, label) {
  if (!u || u.dead || ftKid(u) || !(u.hero || u.rec || isPerson(u))) return;
  const now = ftNow();
  const had = u.pzUntil > now;
  u.pzUntil = Math.max(u.pzUntil || 0, now + dur);
  if (!had) {
    floater(u.x, u.y - 2.1, label || 'Яд!', '#9ae040');
    fxBurst(u.x * TILE, u.y * TILE - 10, 8, ['#9ae040', '#5aa020', '#d8ff90'], 45, 40, 0.6, 1.4, -10);
    if (!(u.pzLog > now - 40)) { u.pzLog = now; logEvent('animal', `${neuName(u)} отравлен ядом жаболюдов`, u.x, u.y); }
  }
}
const FT_TOUCH = { ftG: 0.15, ftB: 0.18, ftP: 0.28, ftR: 0.2, ftK: 0.4 };
{
  const _pv = neuProvoke;
  neuProvoke = function (N, u) {
    const first = !(ftNow() - N.prov < NEU_FORGET);
    _pv(N, u);
    if (!ftIs(N)) return;
    N.tor = 0;
    if (!u || !first) return;
    const L = Game.lairs.find(l => l.id === N.lair);
    if (L) { L.friend = false; L.fr = 0; }
    let n = 0;
    for (const M of Game.neutrals) if (M !== N && neuAlive(M) && ftIs(M) && M.lair === N.lair && !M.tg) { M.tg = u.id; M.prov = ftNow(); M.tor = 0; M.cdA = 0.2 + ftRand() * 0.8; M.pat = 0; n++; }
    sfxAt('ftCroak', N.x * TILE, N.y * TILE, 0.9);
    if (n) logEvent('animal', 'Жаболюды всей деревней бросились в драку: «Ква-ква-ква!»', N.x, N.y);
  };

  // ядовитая кожа при ближнем ударе; в тумане и на дереве достают хуже
  const _nh = neuHit;
  neuHit = function (N, u, dmg) {
    if (!ftIs(N) || !neuAlive(N)) return _nh(N, u, dmg);
    const now = ftNow(), melee = u && Math.hypot(u.x - N.x, u.y - N.y) < 2.4;
    if (ftInFog(N.x, N.y, N) && ftRand() < 0.35) { neuProvoke(N, u); floater(N.x, N.y - 1.8, 'Мимо в тумане!', '#cfe8d8'); return; }
    if (N.pch && melee && ftRand() < 0.3) { neuProvoke(N, u); floater(N.x, N.y - 1.8, 'Не достать!', '#e8e0c0'); return; }
    if (N.pch) { const sp = N.pch; N.pch = null; N.cdA = Math.max(N.cdA, 0.4); N.tgMem = 0; ftLeapDown(N, u, sp); }
    if (N.tor) { N.tor = 0; N.cold = true; }
    if (melee && u && (u.hero || u.rec) && ftRand() < (FT_TOUCH[N.k] || 0.15) * (N.wet > 0.2 ? 1 : 0.3)) ftPoison(u, N, 7, 'Ядовитая кожа!');
    const was = N.hp;
    _nh(N, u, dmg);
    if (neuAlive(N) && N.hp < was && typeof cbOn === 'function' && cbOn(N, 'burn')) N.wet = Math.max(0, N.wet - 0.2);
  };
  const _ns = neuStrike;
  neuStrike = function (N, tg) {
    if (!ftIs(N)) return _ns(N, tg);
    if (ftKid(tg)) { N.tg = 0; return; }                                  // дети не страдают
    const now = ftNow(), m = FT.mul, s0 = FT.src;
    FT.mul = m * (N.rage > now ? 1.25 : 1) * (N.cold ? 0.5 : 1) * (N.pch ? 1.15 : 1);
    FT.src = N;
    if (N.k === 'ftB' || N.k === 'ftP' || N.k === 'ftR') {
      N.dart = { x: Math.round(tg.x * 100) / 100, y: Math.round(tg.y * 100) / 100, t: Math.round(now * 100) / 100, o: N.k === 'ftP' ? 1 : N.k === 'ftR' ? 2 : 0 };
      sfxAt(N.k === 'ftB' ? 'ftDart' : N.k === 'ftR' ? 'ftFire' : 'ftZap', N.x * TILE, N.y * TILE, N.k === 'ftB' ? 0.7 : 0.45);
    } else sfxAt(N.k === 'ftK' ? 'ftCroakLow' : 'ftCroak', N.x * TILE, N.y * TILE, 0.3);
    try { _ns(N, tg); } finally { FT.mul = m; FT.src = s0; }
  };
  const _hu = neuHurtUnit;
  neuHurtUnit = function (u, n) {
    _hu(u, n * FT.mul);
    const N = FT.src;
    if (N && ftIs(N) && u && !ftKid(u)) {
      const dart = N.k === 'ftB', p = dart ? 0.75 : N.k === 'ftK' ? 0.6 : (N.k === 'ftP' || N.k === 'ftR') ? 0.15 : 0.45;
      if (ftRand() < p) ftPoison(u, N, dart ? 7 : 4);
    }
  };
  const _kl = neuKill;
  neuKill = function (N, killer) {
    const L = Game.lairs.find(l => l.id === N.lair), isFt = ftIs(N);
    _kl(N, killer);
    if (!isFt) return;
    N.jp = null; N.pch = null; N.fg = null;
    sfxAt('ftDie', N.x * TILE, N.y * TILE, 0.7);
    if (L && L.k === FT_LAIR && !L.alive) dropPile(Math.floor(N.x), Math.floor(N.y), 'gold', 1);
    if (N.k === 'ftK') logEvent('animal', 'Вождь жаболюдов повержен — болото притихло', N.x, N.y);
  };
}
function ftLeapDown(N, u, sp) {
  // сбитый с дерева — прыжком к обидчику
  const d = Math.hypot(u.x - sp.x, u.y - sp.y) || 1;
  N.jpCd = ftNow() + 2;
  N.x = sp.x; N.y = sp.y;
  ftLeap(N, u.x - (u.x - sp.x) / d * 1.5, u.y - (u.y - sp.y) / d * 1.5, { strike: false });
}

// ---------- Туман шамана ----------
function ftInFog(x, y, except) {
  const now = ftNow();
  for (const M of Game.neutrals) if (M !== except && M.fg && M.fg.u > now && Math.hypot(x - M.fg.x, y - M.fg.y) < M.fg.r) return true;
  return false;
}

// ---------- Наполнение логова и создание существ ----------
{
  const _fl = neuFillLair;
  neuFillLair = function (lair) {
    if (lair.k !== FT_LAIR) return _fl(lair);
    const nights = Game.ft ? Game.ft.nt : 0;
    const ks = ['ftG', 'ftG', 'ftB', 'ftB', 'ftP'];
    const extra = Math.min(3, (ftRand() * 3) | 0);                         // 5…8 жителей
    for (let i = 0; i < extra; i++) ks.push(i === 0 && (lair.lv > 1.25 || nights >= 4) ? 'ftK' : i === 1 ? 'ftB' : 'ftG');
    if (ks.length < 8 && !ks.includes('ftK') && (lair.lv > 1.25 || nights >= 4) && ks.length >= 6) ks[ks.length - 1] = 'ftK';
    if (ks.length >= 6 && (nights >= 2 || lair.lv > 1.15)) ks[ks.indexOf('ftG')] = 'ftR';       // огнемаг приходит со 2-й ночи
    ks.forEach((k, i) => Game.neutrals.push(neuMake(k, lair, i)));
    lair.respawn = 0; lair.alive = ks.length;
  };
  const _mk = neuMake;
  neuMake = function (k, lair, i) {
    const N = _mk(k, lair, i);
    if (FT_KINDS[k]) { N.wet = 1; N.face = ftRand() < 0.5 ? 1 : -1; }
    return N;
  };
}

// ---------- Поселения: где, сколько, когда ----------
const FT_BIOME = { swamp: 2, meadow: 1, forest: 1, steppe: 0.5, mountain: 0.5, winter: 0 };
function ftQuota() {
  const b = typeof biomeId === 'function' ? biomeId() : null, w = b && FT_BIOME[b] !== undefined ? FT_BIOME[b] : 1;
  if (w <= 0) return 0;
  return Math.max(1, Math.round(2 * w * (N_TILES / 19200)));
}
const ftWant = n => { const q = ftQuota(); return Math.min(q, Math.ceil(q / 2) + (n >= 2 ? 1 : 0) + (n >= 4 ? 1 : 0)); };

function ftSite(stamp, relax) {
  const cx = MAP_W >> 1, cy = MAP_H >> 1, minStart = mapIsLegacy() ? 20 : 24;
  for (let t = 0; t < 3500; t++) {
    const x = 6 + ((ftRand() * (MAP_W - 12)) | 0), y = 6 + ((ftRand() * (MAP_H - 12)) | 0), i = idx(x, y);
    if (World.terrain[i] !== T_GRASS || World.bmap[i] || World.road[i] || !reachedIn(stamp, x, y)) continue;
    if (Math.hypot(x - cx, y - cy) < minStart + (t < 1800 ? 4 : 0)) continue;
    let water = 0, nearW = 99, bad = false;
    for (let yy = y - 8; yy <= y + 8 && !bad; yy++) for (let xx = x - 8; xx <= x + 8; xx++) {
      if (!inb(xx, yy)) { bad = true; break; }
      const j = idx(xx, yy), d = Math.hypot(xx - x, yy - y);
      if (World.bmap[j] && d < 4) { bad = true; break; }
      if (World.terrain[j] === T_WATER) { water++; if (d < nearW) nearW = d; }
    }
    if (bad) continue;
    if (!relax && (water < 8 || nearW < 3.2 || nearW > 8)) continue;
    if (relax && nearW < 3.2) continue;
    if (Game.buildings.some(b => Math.hypot(b.x - x, b.y - y) < 12)) continue;
    if (Game.lairs.some(l => Math.hypot(l.x - x, l.y - y) < 13)) continue;
    return { x, y, ds: Math.hypot(x - cx, y - cy), minStart };
  }
  return null;
}
// спавн идёт на своём генераторе: общий Math.random не сдвигается (детерминизм и чужие тесты по сиду не зависят от жаболюдов)
function ftSpawnLair(announce) {
  const mr = Math.random; Math.random = ftRand;
  try { return ftSpawnLair0(announce); } finally { Math.random = mr; }
}
function ftSpawnLair0(announce) {
  if (!Game.ft) return null;
  const stamp = FT.stamp || (FT.stamp = floodFrom(MAP_W >> 1, MAP_H >> 1));
  const site = ftSite(stamp, false) || ftSite(stamp, true);
  if (!site) return null;
  const cap = typeof n2Cap === 'function' ? n2Cap(Game.ft.nt) : 1;
  if (typeof N2 !== 'undefined') N2.rk0 = Game.ft.nt >= 1 ? Math.max(1, cap - 2) : 0;
  const L = neuAddLair(FT_LAIR, site, site.minStart);
  if (typeof N2 !== 'undefined') N2.rk0 = 0;
  L.rk0 = Game.ft.nt >= 1 && typeof n2Cap === 'function' ? Math.max(1, cap - 2) : 0;
  Game.ft.sp++;
  if (announce) logEvent('animal', 'У воды на болоте поселились жаболюды — Свайная деревня', L.x + 0.5, L.y + 0.5);
  return L;
}

// ---------- Раз в секунду: ночи, территория, яд, друзья ----------
function ftTick(dt) {
  if (!Game.lairs || Game.stress) return;
  FT.q += dt; FT.t5 += dt;
  if (FT.q < 0.25) return;
  const q = FT.q; FT.q = 0;
  const now = ftNow();
  // яд: герой и рекруты теряют здоровье (не ниже 1), все — замедлены (entities.js); вода смывает
  for (const u of Game.units) {
    if (!(u.pzUntil > now)) continue;
    if (u.dead || u.inside) continue;
    if (ftWaterNear(u.x, u.y, 1.8)) { u.pzUntil = 0; floater(u.x, u.y - 2, 'Вода смыла яд', '#bfe8ff'); continue; }
    if (u.hero && u.hero.hp > 1) u.hero.hp = Math.max(1, u.hero.hp - 1.2 * q);
    else if (u.rec) { const R = u.rec; if (R.hp == null) R.hp = 30 + 8 * R.lvl; if (R.hp > 1) R.hp = Math.max(1, R.hp - 1.2 * q); }
    if (Math.floor(now * 2) % 4 === 0 && !(u._pzFx > now - 0.9)) { u._pzFx = now; fxBurst(u.x * TILE, u.y * TILE - 12, 2, ['#9ae040', '#5aa020'], 20, 20, 0.5, 1.2, -10); }
  }
  for (const u of Game.units) {
    if (!(u.brnUntil > now) || u.dead || u.inside) continue;
    if (ftWaterNear(u.x, u.y, 1.8)) { u.brnUntil = 0; floater(u.x, u.y - 2, 'Вода погасила огонь', '#bfe8ff'); continue; }
    if (u.hero && u.hero.hp > 1) u.hero.hp = Math.max(1, u.hero.hp - 1.5 * q);
    else if (u.rec) { const R = u.rec; if (R.hp == null) R.hp = 30 + 8 * R.lvl; if (R.hp > 1) R.hp = Math.max(1, R.hp - 1.5 * q); }
    if (!(u._brFx > now - 0.7)) { u._brFx = now; fxBurst(u.x * TILE, u.y * TILE - 14, 3, ['#ff9a30', '#ffe070'], 25, 25, 0.5, 1.2, -30); }
  }
  // туман (замедление чужих; громовик — после молнии)
  for (const M of Game.neutrals) {
    if (!M.fg) continue;
    if (M.fg.u <= now || !neuAlive(M)) { M.fg = null; continue; }
    for (const u of Game.units) if (!u.dead && !u.inside && !ftKid(u) && Math.hypot(u.x - M.fg.x, u.y - M.fg.y) < M.fg.r) u.fgUntil = now + 0.8;
  }
  FT.sec += q;
  if (FT.sec < 1) return;
  FT.sec = 0;
  if (!Game.ft) Game.ft = { nt: startNights(), sp: Game.lairs.filter(l => l.k === FT_LAIR).length };
  const custom = typeof MapOpt !== 'undefined' && MapOpt.custom && MapOpt.custom.nm !== 'auto';
  if (startOpen('neutrals') && !custom && ftQuota() > 0) {
    const nights = startNights();
    while (Game.ft.nt < nights) { Game.ft.nt++; FT.stamp = null; }
    if (Game.ft.sp < ftWant(Game.ft.nt)) { if (ftSpawnLair(true)) FT.fails = 0; else if (++FT.fails > 20) Game.ft.sp = ftWant(Game.ft.nt); }   // по одной за такт: не сразу пачкой
  }
  for (const L of Game.lairs) if (L.k === FT_LAIR) ftLairTick(L, now);
}
FT.fails = 0;

function ftLairTick(L, now) {
  const mem = Game.neutrals.filter(N => N.lair === L.id && neuAlive(N));
  if (!mem.length) return;
  const cx = L.x + 0.5, cy = L.y + 0.5, winter = ftWinter();
  const near = Game.units.filter(u => !u.dead && !u.inside && Math.hypot(u.x - cx, u.y - cy) < FT_TERR_R);
  const hero = Game.hero;
  // подсказка при первой встрече
  if (!FT.hinted && hero && !hero.dead && Math.hypot(hero.x - cx, hero.y - cy) < 9 && !isServerSim()) {
    FT.hinted = true;
    toast('Жаболюды недоверчивы: чужаков гонят, но их можно задобрить. Shift + клик по жаболюду — одарить (хмель, пиво, золото). Вдали от воды они сохнут!');
    logEvent('animal', 'Герой впервые встретил жаболюдов — болотный народ', cx, cy);
  }
  if (L.friend) { ftFriend(L, mem, now); return; }
  if (winter) return;
  const fighters = near.filter(u => (u.hero && u.hero.hp > 0) || (u.rec && !neuUnitOut(u)));
  if (fighters.length && startOpen('neutrals') && !mem.some(M => M.tg)) {
    L.warn = (L.warn || 0) + 1;
    if (L.warn === 1) { const M = mem[0]; floater(M.x, M.y - 2.4, 'Ква! Прочь!', '#ffe9a0'); sfxAt('ftCroak', M.x * TILE, M.y * TILE, 0.7); }
    if (L.warn >= 4) { L.warn = 0; const u = fighters[0], M = mem.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0]; neuProvoke(M, u); }
  } else if (L.warn) L.warn = Math.max(0, L.warn - 1);
  // обычных гномов пугают и прогоняют, не калеча; дети — приманка для дружелюбного «ква»
  for (const u of near) {
    if (u.hero || u.rec || !isPerson(u)) continue;
    if (ftKid(u)) {
      if (!(L.kidT > now - 20)) { L.kidT = now; const M = mem[(ftRand() * mem.length) | 0]; floater(M.x, M.y - 2.2, 'Ква-а? (мило)', '#ffe9c8'); if (!M.jp && !M.pch) { M.ov = NA_FRAMES.jump; M.ovT = 0; M.ovP = 0.08; M.fr = 'j0'; } sfxAt('ftCroak', M.x * TILE, M.y * TILE, 0.3); }
      continue;
    }
    if (!(L.shoo > now - 20)) { L.shoo = now; u.fleeUntil = now + 5; floater(u.x, u.y - 1.8, 'Ква! Брысь!', '#ffe9a0'); }
  }
}

// друзья: дань, праздник, оборона
function ftFriend(L, mem, now) {
  if (!(L.tribT > now)) {
    if (L.tribT !== undefined) {
      const o = randomFreeNear(L.x + 2, L.y + 3, 0, 2, (x, y) => isWalkable(x, y));
      if (o) { dropPile(o[0], o[1], 'venom', 1); dropPile(o[0], o[1], 'slime', 1); floater(o[0] + 0.5, o[1] - 0.6, 'Дань жаболюдов', '#9ae040'); }
    }
    L.tribT = now + 240;
  }
  if (typeof festOn === 'function' && festOn() && !(L.fest > now - 25)) {
    L.fest = now;
    for (const M of mem) if (!M.tg && !M.jp && !M.pch) { M.winT = 3 + ftRand() * 2; M.st = 'idle'; }
    sfxAt('ftCroak', L.x * TILE, L.y * TILE, 0.8);
    if (!L.festLog) { L.festLog = 1; logEvent('animal', 'Друзья-жаболюды поют на празднике хором: «Ква-ква-кваааа!»', L.x + 0.5, L.y + 0.5); }
  } else if (!(typeof festOn === 'function' && festOn())) L.festLog = 0;
  // оборона: охотники и шаманы друзей метают дротики в грабителей и нечисть рядом
  if (!(L.defT > now) && !ftWinter()) {
    L.defT = now + 3;
    const at = mem.find(M => M.k === 'ftB' || M.k === 'ftP');
    if (!at) return;
    for (const R of Game.raiders || []) {
      if (typeof foeLive !== 'function' || !foeLive(R) || R.st === 'emerge' || Math.hypot(R.x - L.x, R.y - L.y) > 11) continue;
      if (typeof foeHit === 'function' && typeof DEF_KILLER !== 'undefined') { DEF_KILLER.x = at.x; DEF_KILLER.y = at.y; foeHit(R, DEF_KILLER, 5 + (at.rk || 1)); }
      if (typeof defShot === 'function') Game.dshots.push({ x: at.x, y: at.y - 0.5, gx: R.x, gy: R.y - 0.5, born: now, dur: 0.3, k: 'dart' });
      at.dart = { x: Math.round(R.x * 100) / 100, y: Math.round(R.y * 100) / 100, t: Math.round(now * 100) / 100, o: 0 };
      at.face = R.x >= at.x ? 1 : -1; at.ov = NA_FRAMES.throwd; at.ovT = 0; at.ovP = 0.08;
      sfxAt('ftDart', at.x * TILE, at.y * TILE, 0.6);
      if (!(L.defLog > now - 90)) { L.defLog = now; logEvent('animal', 'Жаболюды-друзья метнули дротики во врагов у деревни', R.x, R.y); }
      break;
    }
  }
}

// ---------- Дары: Shift+клик ----------
const FT_GIFT = { hops: 12, sausage: 12, beer: 14, bread: 6, potion: 20, gold: 22, magicstone: 20, mana: 16, goldore: 22, chickenleg: 10 };
function* ftGiftGen(u, c) {
  const N = c.f.o, L = Game.lairs.find(l => l.id === N.lair);
  if (!neuAlive(N) || !L) return;
  if (!u.hero) { floater(N.x, N.y - 1.8, 'Квак? Только с героем!', '#ffe9a0'); return; }
  const H = u.hero;
  for (let k = 0; k < 8 && Math.hypot(N.x - u.x, N.y - u.y) > 1.8; k++) {
    const ok = yield { walk: [Math.floor(N.x), Math.floor(N.y)], offroad: true };
    if (!ok || !neuAlive(N)) return;
  }
  u.face = N.x > u.x ? 1 : -1; u.vdir = 'E';
  const slot = H.inv ? H.inv.findIndex(s => s && FT_GIFT[s.k]) : -1;
  if (slot < 0) {
    floater(N.x, N.y - 1.9, 'Ква? Пусто…', '#ffe9a0');
    toast('Жаболюдам нравятся хмель, пиво, колбаса, золото, зелья и магические камни: положите дар в рюкзак героя. Клик без Shift — напасть');
    return;
  }
  yield { wait: 0.8, anim: 'build' };
  if (!neuAlive(N) || !H.inv[slot]) return;
  const s = H.inv[slot], k = s.k;
  s.n--; if (s.n <= 0) H.inv[slot] = null;
  L.fr = Math.min(100, (L.fr || 0) + FT_GIFT[k]);
  N.winT = 2; N.tor = 0;
  fxBurst(N.x * TILE, N.y * TILE - 14, 14, ['#9ae040', '#ffe070', '#d8ffd8'], 60, 60, 0.9, 1.6, -30);
  sfxAt('ftCroak', N.x * TILE, N.y * TILE, 0.6);
  if (L.fr < 50) { floater(N.x, N.y - 2, `Ква! Спасибо (дружба ${L.fr}/50)`, '#9ae040'); return; }
  if (!L.friend) {
    L.friend = true;
    for (const M of Game.neutrals) if (M.lair === L.id) { M.tg = 0; M.prov = -99; }
    logEvent('animal', `${H.name} подружился с жаболюдами`, N.x, N.y);
  }
  ftReward(u, L, N);
}
function ftReward(u, L, N) {
  const H = u.hero, kind = (L.rw = (L.rw || 0) + 1) % 3, mate = Game.units.filter(x => x.teamOf === u.id);
  if (kind === 1) {                          // водное исцеление
    H.hp = H.maxhp; u.injury = null; u.pzUntil = 0; for (const m of mate) { m.injury = null; m.pzUntil = 0; }
    floater(u.x, u.y - 2.1, 'Жаболюды исцелили водой!', '#9af0a0');
    logEvent('animal', `Жаболюды исцелили героя ${H.name} болотной водой`, u.x, u.y);
  } else if (kind === 2) {                   // прыжок-благословение
    for (const x of [u, ...mate]) x.boostUntil = ftNow() + 90;
    u.dashUntil = ftNow() + 40;
    floater(u.x, u.y - 2.1, 'Лягушачья резвость!', '#ffe070');
    logEvent('animal', `Жаболюды благословили героя ${H.name}: бодрее на полторы минуты`, u.x, u.y);
  } else {                                   // яд и слизь
    const o = randomFreeNear(Math.floor(N.x), Math.floor(N.y) + 1, 0, 2, (x, y) => isWalkable(x, y)) || [Math.floor(N.x), Math.floor(N.y)];
    dropPile(o[0], o[1], 'venom', 3); dropPile(o[0], o[1], 'slime', 3);
    floater(o[0] + 0.5, o[1] - 0.6, 'Дар: яд и слизь!', '#9ae040');
    logEvent('animal', `Жаболюды одарили ${H.name} ядом и слизью`, N.x, N.y);
  }
  if (typeof updateUI === 'function') updateUI(true);
}
{
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    if (inb(t[0], t[1]) && typeof event !== 'undefined' && event && event.shiftKey) {
      const f = foesNear(t[0] + 0.5, t[1] + 0.5, 1.4).find(x => x.kind === 'neu' && ftIs(x.o));
      if (f && !(ftNow() - f.o.prov < NEU_FORGET)) return { kind: 'ftgift', f, tx: Math.floor(f.o.x), ty: Math.floor(f.o.y), label: 'Одарить: ' + NSPEC[f.o.k].name + ' (клик — напасть)' };
    }
    return _rc(t);
  };
  const _run = runCmd;
  runCmd = function* (u, c) { if (c.kind === 'ftgift') yield* ftGiftGen(u, c); else yield* _run(u, c); };
}

// ---------- Тик, старт, сохранение, зеркало ----------
{
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) ftTick(dt); };
  const _setup = setupStart;
  setupStart = function (...a) {
    _setup(...a);
    FT.rng = mulberry32((((a[0] | 0) ^ 0x7F0A91) >>> 0)); FT.stamp = null; FT.hinted = false; FT.fails = 0;
    Game.ft = { nt: startNights(), sp: 0 }; Game.ftw = null;
    const custom = typeof MapOpt !== 'undefined' && MapOpt.custom && MapOpt.custom.nm !== 'auto';
    if (Game.stress || custom || isMirror()) return;
    for (let i = 0, n = Math.ceil(ftQuota() / 2); i < n; i++) if (!ftSpawnLair(false)) break;
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.ft = null; Game.ftw = null; FT.stamp = null; };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    if (s.nt && Game.ft) s.nt.ft = { nt: Game.ft.nt, sp: Game.ft.sp };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    Game.ftw = null; FT.stamp = null;
    const nt = s && s.nt;
    if (isMirror()) { Game.ft = null; return; }
    if (nt && nt.ft) Game.ft = { nt: nt.ft.nt | 0, sp: nt.ft.sp | 0 };
    else Game.ft = { nt: startNights(), sp: Game.lairs.filter(l => l.k === FT_LAIR).length };       // старый сейв: колонии придут на ближайших ночах
    for (const N of Game.neutrals) if (ftIs(N)) N.wet = 1;
  };
  const _nm = neuMirror;
  neuMirror = function () {
    const a = _nm(), by = new Map(Game.neutrals.map(N => [N.id, N])), now = ftNow();
    for (const d of a) {
      const N = by.get(d.id);
      if (!N || !ftIs(N)) continue;
      if (N.wet < 0.3) d.wet = Math.round(N.wet * 100) / 100;
      if (N.pch) d.pch = 1;
      if (N.tor) d.tor = 1;
      if (N.dart && now - N.dart.t < 0.4) d.dart = N.dart;
      if (N.fg && N.fg.u > now) d.fg = N.fg;
      if (N.zap && now - N.zap.t < 0.5) d.zap = N.zap;
    }
    return a;
  };
}

// ---------- Рисование: дерево, дротик, туман ----------
{
  const _nd = neuDraw;
  neuDraw = function (c, N) {
    if (!ftIs(N)) return _nd(c, N);
    const t = ftNow(), dead = N.st === 'die';
    if (N.pch && !dead) {          // сидит на дереве: спрайт выше земли
      const px = Math.round(N.x * TILE), py = Math.round(N.y * TILE + 6);
      c.fillStyle = 'rgba(10,8,4,0.25)'; c.beginPath(); c.ellipse(px, py + 6, 8, 2.4, 0, 0, 7); c.fill();
      N.y -= 0.62;
      try { _nd(c, N); } finally { N.y += 0.62; }
    } else _nd(c, N);
    if (dead) return;
    // дротик (синий) и водяной шар (шаман) в полёте
    const A = N.dart;
    if (A) {
      const k = (t - A.t) / 0.28;
      if (k >= 0 && k < 1) {
        const x0 = N.x * TILE + N.face * 12, y0 = N.y * TILE - 24 - (N.pch ? 20 : 0), x1 = A.x * TILE, y1 = A.y * TILE - 14;
        const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 7;
        c.save(); c.translate(Math.round(x), Math.round(y));
        if (A.o) {
          c.globalCompositeOperation = 'lighter';
          c.fillStyle = A.o === 2 ? 'rgba(255,140,40,0.55)' : 'rgba(130,210,255,0.5)'; c.beginPath(); c.arc(0, 0, A.o === 2 ? 5 : 4, 0, 7); c.fill();
          c.fillStyle = A.o === 2 ? 'rgba(255,240,150,0.95)' : 'rgba(255,255,255,0.9)'; c.fillRect(-1, -1, 2, 2);
        } else {
          c.rotate(Math.atan2(y1 - y0, x1 - x0));
          c.fillStyle = '#8a6a3a'; c.fillRect(-5, -0.4, 7, 0.8); c.fillStyle = '#7ad830'; c.fillRect(2, -0.8, 3, 1.6); c.fillStyle = '#c04aa0'; c.fillRect(-6, -1.2, 2, 2.4);
        }
        c.restore();
      }
    }
    // молния громовика: ломаная от посоха к цели и по цепи
    const Z = N.zap;
    if (Z && t - Z.t < 0.3 && t - Z.t >= 0) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
      let ox = N.x * TILE + N.face * 12, oy = N.y * TILE - 32 - (N.pch ? 20 : 0);
      for (const [tx, ty] of Z.p) {
        const x1 = tx * TILE, y1 = ty * TILE - 14, n = 6;
        for (const [w, col] of [[3, 'rgba(120,200,255,0.5)'], [1, 'rgba(255,255,255,0.95)']]) {
          c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(ox, oy);
          for (let i = 1; i < n; i++) { const f = i / n, jr = Math.sin(i * 9.7 + Math.floor(t * 40)) * 5; c.lineTo(ox + (x1 - ox) * f + jr, oy + (y1 - oy) * f - jr * 0.6); }
          c.lineTo(x1, y1); c.stroke();
        }
        ox = x1; oy = y1;
      }
      c.restore();
    }
    // туман
    const F = N.fg;
    if (F && F.u > t) {
      c.save();
      const a = Math.min(1, (F.u - t) / 1.5) * 0.9;
      for (let i = 0; i < 9; i++) {
        const ph = t * 0.35 + i * 1.9, rr = (F.r * TILE) * (0.35 + 0.5 * ((i * 37 % 10) / 10));
        const x = F.x * TILE + Math.cos(ph + i) * F.r * TILE * 0.55, y = F.y * TILE - 8 + Math.sin(ph * 0.8 + i) * F.r * TILE * 0.3;
        c.fillStyle = `rgba(205,230,215,${0.16 * a})`; c.beginPath(); c.ellipse(Math.round(x), Math.round(y), rr, rr * 0.5, 0, 0, 7); c.fill();
      }
      c.restore();
    }
    // высох: жёлтая капля над головой
    if (N.wet < 0.3 && N.st !== 'die') {
      const px = Math.round(N.x * TILE), top = Math.round(N.y * TILE + 6 - (N2_TOP[N.k] || 40) - 8);
      c.fillStyle = '#1a1008'; c.fillRect(px + 10, top - 1, 6, 7); c.fillStyle = '#e8d070'; c.fillRect(px + 11, top + 1, 4, 4); c.fillRect(px + 12, top, 2, 1);
    }
  };
}

// ---------- Звуки (своё синтез-ядро sfx.js) ----------
if (typeof SFX !== 'undefined' && typeof SFX_DEF !== 'undefined') {
  Object.assign(SFX_DEF, {
    ftCroak: { pri: 2, gain: 0.6, poly: 3, cd: 0.3, len: 0.5 },
    ftCroakLow: { pri: 3, gain: 0.7, poly: 1, cd: 0.8, len: 0.8, wet: 0.3 },
    ftJump: { pri: 1, gain: 0.45, poly: 3, cd: 0.15, len: 0.25 },
    ftSplash: { pri: 1, gain: 0.5, poly: 2, cd: 0.25, len: 0.4 },
    ftDart: { pri: 1, gain: 0.4, poly: 3, cd: 0.12, len: 0.25 },
    ftHeal: { pri: 1, gain: 0.4, poly: 2, cd: 0.4, len: 0.6, wet: 0.3 },
    ftDie: { pri: 1, gain: 0.45, poly: 2, cd: 0.15, len: 0.4 },
    ftZap: { pri: 2, gain: 0.55, poly: 2, cd: 0.2, len: 0.5 },
    ftFire: { pri: 2, gain: 0.5, poly: 2, cd: 0.2, len: 0.6 },
  });
  const rsp = (d, t, f0, f1, len, vol, fm, am, dp) => { if (typeof rasp === 'function') rasp(d, t, f0, f1, len, vol, fm, am, dp); else tone(d, 'sawtooth', f0, f1, t, len, vol * 0.5, 0.02); };
  Object.assign(SFX, {
    // «ква-ква»: два пульса низкого хриплого тона
    ftCroak: (d, t, v) => { const r = 0.9 + v * 0.2; for (let k = 0; k < 2; k++) { const tt = t + k * 0.17; rsp(d, tt, 230 * r, 170 * r, 0.13, 0.5, 750, 45, 0.8); tone(d, 'sine', 120 * r, 90, tt, 0.1, 0.12, 0.006); } },
    // вождь: глубокое протяжное «кВАААК»
    ftCroakLow: (d, t, v) => { rsp(d, t, 130 + v * 15, 78, 0.6, 0.65, 480, 30, 0.8); tone(d, 'sine', 70, 48, t, 0.55, 0.35, 0.04); noiseHit(d, 'lowpass', 600, 240, 1, t, 0.3, 0.15, 0.04); },
    // шлёпок мокрых лап и «пшик»
    ftJump: (d, t, v) => { tone(d, 'sine', 300 + v * 80, 150, t, 0.07, 0.3, 0.004); noiseHit(d, 'bandpass', 800, 450, 1.2, t, 0.07, 0.2, 0.003); tone(d, 'sine', 180, 120, t + 0.18, 0.05, 0.12, 0.004); },
    ftSplash: (d, t) => { noiseHit(d, 'lowpass', 1900, 300, 0.7, t, 0.3, 0.5, 0.004); noiseHit(d, 'bandpass', 2600, 1300, 1.5, t + 0.02, 0.18, 0.2, 0.01); tone(d, 'sine', 270, 700, t + 0.07, 0.1, 0.18, 0.01); },
    // плевок из трубки: короткий выдох и свист
    ftDart: (d, t) => { noiseHit(d, 'bandpass', 1500, 900, 1.5, t, 0.07, 0.3, 0.004); tone(d, 'triangle', 900, 1500, t + 0.04, 0.12, 0.12, 0.005); noiseHit(d, 'highpass', 3500, 5200, 0.8, t + 0.06, 0.15, 0.12, 0.02); },
    // бульканье исцеляющей воды
    ftHeal: (d, t) => { for (let k = 0; k < 4; k++) tone(d, 'sine', 380 + k * 90, 620 + k * 120, t + k * 0.09, 0.09, 0.16, 0.01); noiseHit(d, 'lowpass', 1200, 400, 0.8, t, 0.4, 0.1, 0.05); },
    // молния: треск, высокий разряд и раскат
    ftZap: (d, t) => { noiseHit(d, 'highpass', 2500, 6000, 0.8, t, 0.12, 0.5, 0.002); tone(d, 'sawtooth', 1800, 200, t, 0.18, 0.3, 0.002); noiseHit(d, 'lowpass', 500, 120, 1, t + 0.08, 0.4, 0.4, 0.01); },
    // огненный шар: шипящий всплеск и глухой хлопок
    ftFire: (d, t) => { noiseHit(d, 'bandpass', 1400, 500, 1, t, 0.35, 0.35, 0.03); tone(d, 'sine', 120, 55, t + 0.18, 0.25, 0.4, 0.004); noiseHit(d, 'lowpass', 900, 200, 0.8, t + 0.18, 0.3, 0.4, 0.004); },
    ftDie: (d, t) => { rsp(d, t, 260, 110, 0.3, 0.45, 650, 50, 0.7); tone(d, 'sine', 140, 60, t + 0.05, 0.3, 0.18, 0.01); },
  });
}

// ---------- Ачивки ----------
function ftAchInit() {
  if (typeof ACHS === 'undefined' || typeof ACH_BY === 'undefined' || ACH_BY.nfrog) return;
  const add = [
    { id: 'nfrog', name: 'Ква-ква, прощайте', desc: 'Побеждён жаболюд. Остальные ква-кают в хоре, но уже без вдохновения.', ev: /победил: (Жаболюд|Вождь жаболюдов)/ },
    { id: 'nfrogking', name: 'Корона слетела', desc: 'Повержен вождь жаболюдов. Золотая корона из тростника оказалась тоже ядовитой.', ev: /Вождь жаболюдов повержен/ },
    { id: 'nfrogfriend', name: 'Друг болота', desc: 'Герой подружился с жаболюдами. Хмеля жалко, зато дань — яд и слизь — капает теперь по расписанию.', ev: /подружился с жаболюдами/ },
    { id: 'nfrogpoison', name: 'Не лижи лягушку', desc: 'Кого-то отравил яд жаболюдов. Совет: болотная вода смывает его быстрее, чем любое оправдание.', ev: /отравлен ядом жаболюдов/ },
    { id: 'nfrogcall', name: 'Хор болотных солистов', desc: 'Шаман жаболюдов созвал на помощь соседние деревни. Драка вышла по-настоящему общинной.', ev: /Шаман жаболюдов созвал/ },
  ];
  for (const a of add) { ACHS.push(a); ACH_BY[a.id] = a; }
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('DOMContentLoaded', ftAchInit);
