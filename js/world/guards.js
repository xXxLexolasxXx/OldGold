'use strict';
// Подъём к Чёрному шпилю: ярусы и стражи (ВРАГ.md, раздел «Подъём к шпилю»).
// Вокруг шпиля — кольца-барьеры (врата). На каждом ярусе стоит страж-мини-босс со свитой; пока он жив,
// врата за ним заперты. Порядок: огонь → лёд → кости → тени → голем, в конце выходит сам Малгор.
// Магические башни на ярусах и у шпиля заряжаются (0,7 с, круг на земле) и бьют по гномам и героям.
// Затмение: чем выше ярус и дольше бой, тем темнее; свет (фонари, костры, маг/паладин/жрец) разгоняет тьму,
// в темноте нечисть бьёт сильнее, а герой чаще промахивается. В третьей фазе Малгор поднимает «эхо павших»:
// призраков гномов и героев, павших на подъёме.
// Считается там же, где вся игра (в кооперативе — на сервере); клиенту уходит Game.foe.tiers и списки врагов.
// Подключается после enemy.js и spire.js.

const GD_ORDER = ['fire', 'ice', 'bone', 'shadow', 'golem'];
const GD_KINDS = {
  fire:   { name: 'Страж огня',   who: 'Игнар Пепельный',   hue: '255,150,60',  mhp: 240, dmg: [7, 11],  cd: 1.7, spd: 1.8, weak: ['archer', 'druid', 'monk'],
    relic: 'Тлеющая печать',  hello: 'Тепло ли тебе, гномик? Сейчас станет жарко.', bye: 'Пепел… к пеплу…', tip: 'после огненного кольца он угасает — бейте!' },
  ice:    { name: 'Страж льда',   who: 'Хьярна Стылая',     hue: '150,210,255', mhp: 260, dmg: [6, 10],  cd: 1.6, spd: 1.7, weak: ['mage', 'paladin', 'barbarian'],
    relic: 'Ледяная печать',  hello: 'Замри. Навсегда.', bye: 'Тает… всё тает…', tip: 'ледяной панцирь гасит удары, но трескается — тогда бейте!' },
  bone:   { name: 'Страж костей', who: 'Староста Мерв',     hue: '230,225,200', mhp: 250, dmg: [6, 10],  cd: 1.6, spd: 1.7, weak: ['paladin', 'priest', 'monk'],
    relic: 'Костяная печать', hello: 'Ещё косточки? Пригодятся.', bye: 'Рассыпаюсь… опять…', tip: 'зовёт скелетов — не давайте им копиться.' },
  shadow: { name: 'Страж теней',  who: 'Безликий Ниль',     hue: '170,90,255',  mhp: 230, dmg: [8, 13],  cd: 1.5, spd: 2.1, weak: ['mage', 'paladin', 'priest'],
    relic: 'Печать сумрака',  hello: 'Ты меня не видишь. А я тебя — вижу.', bye: 'Свет… как больно…', tip: 'под покровом тени его видно только в свете — фонари, маг, паладин.' },
  golem:  { name: 'Страж-голем',  who: 'Глыбень',           hue: '176,124,255', mhp: 420, dmg: [10, 15], cd: 2.3, spd: 1.2, weak: ['rogue', 'warrior', 'barbarian'],
    relic: 'Каменная печать', hello: 'ГРОМ. КАМЕНЬ. ВЫ — ПЫЛЬ.', bye: 'Камень… спать…', tip: 'камень держит удары; после удара о землю он открыт.' },
};
const GD_ZONE_HUE = '176,124,255';

Game.foeZones = [];

const gdT = () => (Game.foe && Game.foe.tiers) || null;
const gdOpen = () => { const T = gdT(); return !T || T.open >= T.n; };
function gdDiff() { const d = typeof dif === 'function' ? dif() : null; return d ? d.foe : 1; }

// ---------- Ярусы: устройство ----------

// Кольца-барьеры вокруг подножия. Внешнее — на безопасном расстоянии от деревни.
function gdBuild(F) {
  if (F.tiers || F.defeated || isMirror()) return F.tiers;
  const cx = F.tx + 1.5, cy = F.ty + 3;
  let dB = 1e9;
  for (const b of Game.buildings) if (!b.removed) dB = Math.min(dB, Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy));
  const [vx, vy] = foeVillageCenter();
  const rMax = Math.min(34, dB - 14, Math.hypot(vx - cx, vy - cy) - 16);
  const n = rMax >= 27 ? 5 : rMax >= 21 ? 4 : rMax >= 14 ? 3 : 0;
  if (!n) { F.tiers = { n: 0, open: 0, none: 1 }; return F.tiers; }
  const kinds = n === 5 ? GD_ORDER.slice() : n === 4 ? ['fire', 'bone', 'shadow', 'golem'] : ['fire', 'bone', 'golem'];
  const r = [];
  for (let i = 0; i < n; i++) r.push(+(rMax - i * (rMax - 8) / (n - 1)).toFixed(2));
  const a0 = Math.atan2(vy - cy, vx - cx);
  const T = { cx, cy, n, open: 0, r, kinds, a0: +a0.toFixed(3), homes: [], towers: [], gates: [], seals: 0, fallen: [], ecl: 0, fightT: 0, clean: 1 };
  // клетки колец: те, что сейчас свободны, становятся стеной (-1, как подножие башни)
  for (let i = 0; i < n; i++) {
    const R = r[i], cells = [];
    for (let y = Math.floor(cy - R - 2); y <= cy + R + 2; y++) for (let x = Math.floor(cx - R - 2); x <= cx + R + 2; x++) {
      if (!inb(x, y)) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (Math.abs(d - R) > 0.8) continue;
      const k = idx(x, y);
      if (World.bmap[k] || World.terrain[k] === T_WATER) continue;
      World.bmap[k] = -1; cells.push(k);
    }
    T.gates.push(cells);
  }
  // стражи: страж i стоит снаружи кольца i (между кольцом i-1 и i), на линии к деревне
  for (let i = 0; i < n; i++) {
    const rad = i === 0 ? r[0] + 4 : (r[i] + r[i - 1]) / 2;
    let h = null;                                   // на линии занято (вода, скалы) — ищем по дуге яруса
    for (const da of [0, 0.25, -0.25, 0.5, -0.5, 0.8, -0.8, 1.2, -1.2, 1.7, -1.7, 2.3, -2.3, 3.1]) if ((h = gdSpot(cx + Math.cos(a0 + da) * rad, cy + Math.sin(a0 + da) * rad, 3))) break;
    T.homes.push(h || [cx + Math.cos(a0) * rad, cy + Math.sin(a0) * rad]);
  }
  // башни: по одной на ярусах 1…n-1 (сбоку от стража) и две у самого шпиля
  for (let i = 1; i < n; i++) {
    const rad = (r[i] + r[i - 1]) / 2, a = a0 + (i % 2 ? 0.5 : -0.5) * Math.min(1, 9 / rad);
    T.towers.push({ tier: i, p: gdSpot(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 3), hp: -1 });
  }
  for (const s of [-1, 1]) T.towers.push({ tier: n, p: gdSpot(cx + Math.cos(a0 + s * 1.1) * 5, cy + Math.sin(a0 + s * 1.1) * 5, 2), hp: -1 });
  T.towers = T.towers.filter(t => t.p);
  F.tiers = T;
  // никто не должен остаться запертым внутри колец
  for (const u of Game.units) {
    if (u.dead || u.inside || !isPerson(u)) continue;
    const d = Math.hypot(u.x - cx, u.y - cy);
    if (d > r[0] + 1.2) continue;
    const a = Math.atan2(u.y - cy, u.x - cx), p = gdSpot(cx + Math.cos(a) * (r[0] + 3), cy + Math.sin(a) * (r[0] + 3), 4);
    if (p) { u.x = p[0]; u.y = p[1]; u.path = null; if (typeof heroStopUnit === 'function' && (u.hero || u.rec)) heroStopUnit(u); }
  }
  // Малгор теперь ждёт в башне, пока не пали все стражи
  gdHideBoss(F);
  PF.regT = -1e9;
  gdSpawnAll(F);
  logEvent('night', `Вокруг Чёрного шпиля поднялись магические врата: ${n} ярусов, ${n} стражей`, cx, cy);
  return T;
}

function gdSpot(x, y, r) {
  const fx = Math.floor(x), fy = Math.floor(y);
  const p = isWalkable(fx, fy) ? [fx, fy] : randomFreeNear(fx, fy, 1, r, (a, b) => isWalkable(a, b));
  return p ? [p[0] + 0.5, p[1] + 0.5] : null;
}

function gdHideBoss(F) {
  const T = F.tiers;
  if (!T || T.open >= T.n) return;
  for (let i = Game.raiders.length - 1; i >= 0; i--) if (Game.raiders[i].k === 'malgor') { F.bossHp = Math.max(F.bossHp, Game.raiders[i].hp); Game.raiders.splice(i, 1); }
  F.boss = null;
}

function gdSpawnAll(F, hp) {
  const T = F.tiers;
  for (let i = T.open; i < T.n; i++) if (T.homes[i]) gdSpawnGuard(F, i, hp && hp[i]);
  T.towers.forEach((t, j) => { if (t.hp !== 0) gdSpawnTower(t, j); });
}

function gdSpawnGuard(F, i, hp) {
  const T = F.tiers, k = T.kinds[i], G = GD_KINDS[k], h = T.homes[i];
  const N = foeMake('g_' + k, h[0], h[1]);
  N.mhp = Math.round(G.mhp * (0.6 + 0.4 * gdDiff()) * (1 + 0.06 * i)); N.hp = hp > 0 ? Math.min(N.mhp, hp) : N.mhp;
  N.gi = i; N.gk = k; N.home = h.slice(); N.cd1 = 3; N.cd2 = 6; N.sk = ''; N.skT = 0; N.vulT = 0; N.woke = false;
  return N;
}

function gdSpawnTower(t, j) {
  const N = foeMake('ftower', t.p[0], t.p[1]);
  N.mhp = Math.round(110 * (0.7 + 0.3 * gdDiff())); N.hp = t.hp > 0 ? Math.min(t.hp, N.mhp) : N.mhp;
  N.tj = j; N.tier = t.tier; N.chg = 0; N.aim = null; N.cdA = 1 + j * 0.4;
  return N;
}

// куда сейчас идти отряду: к стражу текущего яруса (или null — к Малгору)
function guardsFront() {
  const T = gdT();
  if (!T || T.none || T.open >= T.n) return null;
  const h = T.homes[T.open];
  return h ? [Math.floor(h[0]), Math.floor(h[1])] : null;
}
function guardsCurrent() {
  const T = gdT();
  if (!T || T.none || T.open >= T.n) return null;
  return Game.raiders.find(N => N.gi === T.open && foeLive(N)) || null;
}
function guardsDone() { const T = gdT(); return T && !T.none ? T.open : 0; }
function guardsTotal() { const T = gdT(); return T && !T.none ? T.n : GD_ORDER.length; }

// ---------- Свет и затмение ----------

const GD_LIGHT_CLS = { mage: 4.5, paladin: 4.5, priest: 4 };
function gdLights() {
  const T = gdT(), out = [];
  if (!T || T.none) return out;
  const far = T.r[0] + 10;
  for (const u of Game.units) {
    if (u.dead || u.inside || Math.hypot(u.x - T.cx, u.y - T.cy) > far) continue;
    const c = typeof unitCls === 'function' ? unitCls(u) : null;
    let r = c && GD_LIGHT_CLS[c] || (u.hero ? 1.8 : 0);
    if (u.lantern) r = Math.max(r, 3);
    if (u.lampR) r = Math.max(r, u.lampR);                      // «Лампа предков» фонарщика (этап 2)
    if (r) out.push([u.x, u.y, r]);
  }
  for (const b of Game.buildings) if (b.type === 'bonfire' && b.state === 'done' && Math.hypot(b.x - T.cx, b.y - T.cy) < far + 6) out.push([b.x + b.w / 2, b.y + b.h / 2, BONFIRE_SAFE * 0.8]);
  for (const N of Game.raiders) if (N.gk === 'fire' && foeLive(N)) out.push([N.x, N.y, 2.6]);
  return out;
}
function gdLitAt(x, y) {
  const L = Game._gdL || [];
  for (const l of L) if (Math.hypot(l[0] - x, l[1] - y) < l[2]) return true;
  return false;
}
// 0…1: насколько темно в этой точке (вне колец — 0)
function gdDarkAt(x, y) {
  const T = gdT();
  if (!T || T.none || !T.ecl) return 0;
  const d = Math.hypot(x - T.cx, y - T.cy), edge = T.r[0] + 6;
  if (d > edge) return 0;
  return T.ecl * Math.min(1, (edge - d) / 5) * (gdLitAt(x, y) ? 0.15 : 1);
}

// урон по врагам и от врагов (вызывается из enemy.js)
function foeStrikeMul(N, tg) {
  const T = gdT();
  if (!T || T.none || Math.hypot(N.x - T.cx, N.y - T.cy) > T.r[0] + 8) return 1;
  return Math.pow(gdDiff(), 0.8) * (1 + 0.3 * gdDarkAt(tg.x, tg.y));
}
function foeDmgMod(N, u, dmg) {
  const S = FSPEC[N.k], T = gdT();
  if (S.gk) {
    const G = GD_KINDS[S.gk], c = u && typeof unitCls === 'function' ? unitCls(u) : null;
    if (N.veil && !gdLitAt(N.x, N.y) && !(u && gdLitAt(u.x, u.y)) && Math.random() < 0.7) {
      if (Game.time - (N.vlT || 0) > 1.2) { N.vlT = Game.time; floater(N.x, N.y - 2.6, 'Сквозь тень! Нужен свет', '#d8b8ff'); }
      return 0;
    }
    if (c && G.weak.includes(c)) { dmg *= 1.4; if (Game.time - (N.wkT || 0) > 4) { N.wkT = Game.time; floater(N.x, N.y - 2.8, 'Уязвим!', '#ffe070'); } }
    if (N.vulT > Game.time) dmg *= 1.7;
    else if (S.gk === 'golem') dmg *= 0.6;
  }
  if (T && !T.none && u && u.hero && T.seals) dmg *= 1 + 0.05 * T.seals;      // печати стражей усиливают героя
  return dmg;
}

// ---------- Зоны-телеграфы: круг на земле, через dur — удар ----------

function gdZone(o) {
  const z = Object.assign({ id: Game.nextId++, t: 0, r: 1.2, dur: 0.8, dmg: [8, 12], hue: GD_ZONE_HUE, done: false }, o);
  Game.foeZones.push(z);
  return z;
}
function gdZonesTick(dt) {
  for (let i = Game.foeZones.length - 1; i >= 0; i--) {
    const z = Game.foeZones[i];
    z.t += dt;
    if (!z.done && z.t >= z.dur) {
      z.done = true;
      const own = foeUnit(z.own), mul = own ? foeStrikeMul(own, { x: z.x, y: z.y }) : Math.pow(gdDiff(), 0.8);
      fxBurst(z.x * TILE, z.y * TILE - 4, 18 + z.r * 6, ['rgb(' + z.hue + ')', '#ffffff', '#b07cff'], 90, 50, 0.6, 2, 100);
      sfxAt('crackle', z.x * TILE, z.y * TILE, 0.6);
      if (z.dmg) for (const u of Game.units) {
        if (u.dead || u.inside || !isPerson(u) || neuUnitOut(u) || Math.hypot(u.x - z.x, u.y - z.y) > z.r) continue;
        neuHurtUnit(u, foeR(z.dmg[0], z.dmg[1]) * mul * 0.8);
        u.ouchUntil = Game.time + 0.5;
        if (u.hero && u.hero.hp <= 0 && own) foeHeroDown(own, u);
      }
      if (z.fn) { try { z.fn(); } catch (e) { console.error(e); } }
    }
    if (z.t >= z.dur + 0.35) Game.foeZones.splice(i, 1);
  }
}

// ---------- Стражи: поведение ----------

function gdTargetNear(N, x, y, r) {
  let best = null, bd = r;
  for (const u of Game.units) {
    if (u.dead || u.inside || !isPerson(u) || neuUnitOut(u) || !(u.hero || u.rec || u.freed)) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function gdSummon(N, k, n, tint) {
  for (let i = 0; i < n; i++) {
    const p = randomFreeNear(Math.floor(N.x), Math.floor(N.y), 1, 3, (x, y) => isWalkable(x, y)) || [Math.floor(N.x), Math.floor(N.y)];
    const M = foeMake(k, p[0] + 0.5, p[1] + 0.5);
    M.summoned = true; M.hunt = true; M.st = 'emerge'; M.t = -0.35 * i; M.owner = N.id; M.tint = tint || '';
    fxBurst(M.x * TILE, M.y * TILE - 8, 14, ['#2a2452', 'rgb(' + (tint || GD_ZONE_HUE) + ')'], 70, 50, 0.9, 2, 100);
  }
}
const gdMinions = N => Game.raiders.filter(M => foeLive(M) && M.owner === N.id).length;

function gdWake(N, tg) {
  const G = GD_KINDS[N.gk];
  N.woke = true; N.tg = tg.id; N.prov = Game.time;
  floater(N.x, N.y - 3.2, G.hello, '#ffe0b0');
  toast(`${G.name} ${G.who}: «${G.hello}» Подсказка: ${G.tip}`);
  sfxAt('wail', N.x * TILE, N.y * TILE, 1);
  if (gdMinions(N) < 2) gdSummon(N, N.gk === 'bone' ? 'bonem' : 'thrall', N.gk === 'bone' ? 1 : 2, G.hue);       // свита
}

function gdCast(N, sk, wind) { N.sk = sk; N.skT = 0; N.skW = wind; N.skF = false; N.st = 'cast'; N.castT = wind; }

// начать спец-атаку: телеграф сразу (круг), удар — когда круг «дозреет»
function gdSpecStart(N, tg, which) {
  const G = GD_KINDS[N.gk], k = N.gk, own = N.id, dmg = G.dmg, hue = G.hue;
  const shot = (x, y, dur) => Game.foeShots.push({ id: Game.nextId++, x: N.x, y: N.y - 1.6, gx: x, gy: y, t: 0, dur, fix: true, vis: true, hue });
  if (k === 'fire') {
    if (which === 1) { gdCast(N, 'fireball', 0.9); gdZone({ x: tg.x, y: tg.y, r: 1.3, dur: 0.9, dmg: [dmg[0] + 3, dmg[1] + 4], hue, own }); shot(tg.x, tg.y, 0.9); }
    else { gdCast(N, 'nova', 1.1); floater(N.x, N.y - 3, 'Огненное кольцо!', '#ffc070'); gdZone({ x: N.x, y: N.y, r: 2.8, dur: 1.1, dmg: [12, 18], hue, own, fn: () => gdVuln(N, 'Пламя угасло — бейте!') }); }
  } else if (k === 'ice') {
    if (which === 1) {
      gdCast(N, 'spikes', 0.9);
      for (let j = 0; j < 3; j++) { const a = j * 2.1 + Math.random(), d = j ? 1.4 : 0; gdZone({ x: tg.x + Math.cos(a) * d, y: tg.y + Math.sin(a) * d, r: 1.0, dur: 0.9 + j * 0.15, dmg: [8, 12], hue, own }); }
    } else { gdCast(N, 'shell', 0.7); N.shield = true; N.shieldT = Game.time + 4.5; floater(N.x, N.y - 3, 'Ледяной панцирь!', '#d0f0ff'); }
  } else if (k === 'bone') {
    if (which === 1) { gdCast(N, 'raise', 0.9); if (gdMinions(N) < 3) gdSummon(N, 'bonem', 1, hue); floater(N.x, N.y - 3, 'Встаньте, косточки!', '#f0ead0'); }
    else {
      gdCast(N, 'spears', 0.8);
      const a = Math.atan2(tg.y - N.y, tg.x - N.x);
      for (let j = 1; j <= 3; j++) gdZone({ x: N.x + Math.cos(a) * j * 1.5, y: N.y + Math.sin(a) * j * 1.5, r: 1.0, dur: 0.7 + j * 0.15, dmg: [8, 13], hue, own });
    }
  } else if (k === 'shadow') {
    if (which === 1) {
      gdCast(N, 'blink', 0.8);
      const x = tg.x, y = tg.y;
      gdZone({ x, y, r: 1.4, dur: 0.8, dmg: [10, 15], hue, own, fn: () => {
        if (!foeLive(N)) return;
        fxBurst(N.x * TILE, N.y * TILE - 16, 18, ['#14102c', '#b07cff'], 80, 50, 0.7, 2, 60);
        const p = randomFreeNear(Math.floor(x), Math.floor(y), 1, 2, (a, b) => isWalkable(a, b));
        if (p && Math.hypot(p[0] - N.home[0], p[1] - N.home[1]) < 15) { N.x = p[0] + 0.5; N.y = p[1] + 0.5; }
      } });
    } else { gdCast(N, 'veil', 0.6); N.veil = true; N.veilT = Game.time + 5; floater(N.x, N.y - 3, 'Покров тени!', '#d8b8ff'); }
  } else if (k === 'golem') {
    if (which === 1) { gdCast(N, 'slam', 1.2); floater(N.x, N.y - 3.4, 'ГРОМ!', '#e0d0ff'); gdZone({ x: N.x, y: N.y, r: 3.0, dur: 1.2, dmg: [14, 20], hue, own, fn: () => gdVuln(N, 'Голем открыт — бейте!') }); }
    else { gdCast(N, 'rock', 1.0); gdZone({ x: tg.x, y: tg.y, r: 1.4, dur: 1.0, dmg: [10, 16], hue: '200,190,170', own }); shot(tg.x, tg.y, 1.0); }
  }
}
function gdVuln(N, msg) { if (!foeLive(N)) return; N.vulT = Game.time + 2.5; floater(N.x, N.y - 3, msg, '#ffe070'); }

function rdGuard(N, dt) {
  const S = FSPEC[N.k];
  N.cdA -= dt; N.cd1 -= dt; N.cd2 -= dt;
  if (N.castT > 0) N.castT -= dt;
  if (N.veil && Game.time > N.veilT) N.veil = false;
  if (N.shield && Game.time > N.shieldT) { N.shield = false; gdVuln(N, 'Панцирь треснул — бейте!'); }
  const T = gdT();
  N.inv = T && N.gi > T.open ? 1 : 0;              // страж за запертыми вратами спит и неуязвим, пока не откроют его ярус
  let tg = N.inv ? null : foeUnit(N.tg);
  if (tg && (neuUnitOut(tg) || tg.inside || Math.hypot(tg.x - N.home[0], tg.y - N.home[1]) > 15)) { N.tg = 0; tg = null; }
  N.scan -= dt;
  if (!tg && !N.inv && N.scan <= 0) {
    N.scan = 0.5;
    const t = gdTargetNear(N, N.home[0], N.home[1], N.woke ? 13 : 10);
    if (t) { N.tg = t.id; N.prov = Game.time; tg = t; }
  }
  if (N.inv) N.tg = 0;
  if (tg && !N.woke) gdWake(N, tg);                 // проснулся и когда подошли, и когда ударили первым
  if (!tg) {                                          // никого: домой и залечиться
    if (N.woke) { N.woke = false; N.sk = ''; N.shield = false; N.veil = false; }
    if (rdStep(N, N.home[0], N.home[1], S.spd, dt)) N.st = 'idle'; else N.st = 'chase';
    if (N.hp < N.mhp) N.hp = Math.min(N.mhp, N.hp + dt * 20);
    return;
  }
  const dist = Math.hypot(tg.x - N.x, tg.y - N.y);
  N.dist = dist;
  if (N.sk) {                                         // идёт спец-атака: стоит и колдует
    N.skT += dt; N.face = tg.x >= N.x ? 1 : -1;
    if (N.skT >= N.skW + 0.3) { N.sk = ''; N.st = 'idle'; }
    return;
  }
  if (!(N.st === 'atk' && N.atkT < 0.56)) {
    if (N.cd1 <= 0 && dist <= 9) { N.cd1 = foeR(4.5, 6) * ({ bone: 1.8, ice: 1, shadow: 1.2, golem: 1.5 }[N.gk] || 1); gdSpecStart(N, tg, 1); return; }
    if (N.cd2 <= 0 && dist <= 7) { N.cd2 = foeR(9, 12) * (N.gk === 'ice' || N.gk === 'shadow' ? 1.2 : 1); gdSpecStart(N, tg, 2); return; }
  }
  if (!foeAttackCycle(N, tg, dt, foeStrike)) {
    N.st = 'chase';
    if (Math.hypot(tg.x - N.home[0], tg.y - N.home[1]) < 14) rdGo(N, tg.x, tg.y, S.spd, dt);
    else rdStep(N, N.home[0], N.home[1], S.spd, dt);
  }
}

// башня: активна, когда открыт её ярус; заряжается 0,7 с (круг на земле) и бьёт
function rdTower(N, dt) {
  const T = gdT();
  N.ph += dt;
  if (!T || T.open < N.tier || Game.foe.defeated) { N.aim = null; N.chg = 0; return; }
  if (N.aim) { N.chg += dt; if (N.chg >= 0.7) { N.aim = null; N.chg = 0; N.cdA = foeR(2.2, 3); } return; }
  N.cdA -= dt;
  if (N.cdA > 0) return;
  let best = null, bd = 9;
  for (const u of Game.units) {
    if (u.dead || u.inside || !isPerson(u) || neuUnitOut(u)) continue;
    const d = Math.hypot(u.x - N.x, u.y - N.y) * (u.hero || u.rec ? 0.85 : 1);
    if (d < bd) { bd = d; best = u; }
  }
  if (!best) { N.cdA = 0.5; return; }
  N.aim = [+best.x.toFixed(2), +best.y.toFixed(2)]; N.chg = 0;
  gdZone({ x: best.x, y: best.y, r: 1.1, dur: 0.7, dmg: [7, 11], hue: GD_ZONE_HUE, own: N.id });
  Game.foeShots.push({ id: Game.nextId++, x: N.x, y: N.y - 2.8, gx: best.x, gy: best.y, t: 0, dur: 0.7, fix: true, vis: true, hue: '190,120,255' });
  sfxAt('chime', N.x * TILE, N.y * TILE, 0.6);
}

// ---------- Победа над стражем: врата открыты ----------

function gdGuardDown(N, killer) {
  const F = Game.foe, T = gdT();
  if (!T || N.gi == null) return;
  const G = GD_KINDS[N.gk];
  floater(N.x, N.y - 3, G.bye, '#ffe0b0');
  for (const M of Game.raiders) if (M.owner === N.id && foeLive(M)) { M.noDrop = true; M.st = 'vanish'; M.vt = 0; }
  T.seals++;
  T.open = Math.max(T.open, N.gi + 1);
  for (const k of T.gates[N.gi] || []) if (World.bmap[k] === -1) World.bmap[k] = 0;
  PF.regT = -1e9;
  for (const u of Game.units) if (u.hero && !u.dead) {
    const H = u.hero;
    H.cxp = (H.cxp || 0) + 80; (H.relics = H.relics || []).includes(G.relic) || H.relics.push(G.relic);
    if (H.maxhp && H.hp > 0 && Math.hypot(u.x - N.x, u.y - N.y) < 14) { H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.4); floater(u.x, u.y - 2.2, 'Печать согревает: +40% здоровья', '#ffe070'); }
  }
  const who = killer ? neuName(killer) : 'Герои';
  const next = T.open < T.n ? GD_KINDS[T.kinds[T.open]] : null;
  toast(`${who} победил: ${G.name}! Получена «${G.relic}» (${T.seals}/${T.n}). Врата открыты${next ? ' — дальше ' + next.name.toLowerCase() : ' — путь к Малгору свободен!'}`);
  logEvent('night', `${who} победил: ${G.name} ${G.who} — врата яруса ${N.gi + 1} открыты`, N.x, N.y);
  if (typeof track === 'function') track('foe-guard-' + N.gk, 'Побеждён ' + G.name);
  // тропа к следующему ярусу
  if (typeof spireEnsureRoute === 'function') { try { spireEnsureRoute(Math.floor(N.x), Math.floor(N.y)); } catch (e) { console.error(e); } }
  if (T.open >= T.n) {
    foeSpawnBoss(F);
    if (F.boss) { F.boss.woke = false; floater(F.boss.x, F.boss.y - 3.4, 'Довольно игр. Я сам.', '#b8ff90'); }
    toast('Все стражи пали. Из Чёрного шпиля выходит тёмный маг Малгор!');
  }
}

// ---------- Призраки павших (в коде — echo) ----------

function gdFallenTick(T) {
  const far = T.r[0] + 6;
  for (const u of Game.units) {
    if (Math.hypot(u.x - T.cx, u.y - T.cy) > far) continue;
    let down = false;
    if (u.hero) down = u.hero.downT > Game.time || u.hero.hp <= 0;
    else if (u.rec) down = u.rec.hp != null && u.rec.hp <= 0 && u.downUntil > Game.time;
    else if (isPerson(u)) down = !!u.dead;
    if (!down) { if (!u.dead) u._ecDn = false; continue; }
    if (u._ecDn) continue;
    u._ecDn = true;
    if (T.fallen.length >= 16) continue;
    T.fallen.push({ n: u.hero ? u.hero.name : typeof neuName === 'function' ? neuName(u) : 'Гном', k: u.hero ? 'hero' : u.rec ? 'rec' : 'gnome', c: unitCls(u) || u.type || '' });
    T.clean = 0;
    floater(u.x, u.y - 2.4, 'Вернётся призраком…', '#c8a8ff');
  }
}

function gdEcho(B) {
  const T = gdT();
  if (!T || T.none) return;
  const cap = Math.round(6 * gdDiff()), list = T.fallen.slice(-cap);
  if (!list.length) {
    toast('Призраков павших нет: на подъёме никто не погиб. Малгору некого поднять!');
    floater(B.x, B.y - 3.6, 'Где… где мои мёртвые?!', '#b8ff90');
    return;
  }
  list.forEach((f, i) => {
    const p = randomFreeNear(Math.floor(B.x), Math.floor(B.y), 2, 4, (x, y) => isWalkable(x, y)) || [Math.floor(B.x), Math.floor(B.y) + 2];
    const M = foeMake('echo', p[0] + 0.5, p[1] + 0.5);
    M.mhp = M.hp = Math.round((f.k === 'hero' ? 70 : f.k === 'rec' ? 50 : 34) * (0.7 + 0.3 * gdDiff()));
    M.summoned = true; M.hunt = true; M.st = 'emerge'; M.t = -0.5 * i; M.ename = f.n; M.look = { k: f.k, c: f.c };
  });
  const names = list.map(f => f.n).slice(0, 4).join(', ') + (list.length > 4 ? '…' : '');
  floater(B.x, B.y - 3.6, 'Встаньте, павшие! Служите мне!', '#b8ff90');
  toast(`Призраки павших: Малгор поднял тех, кто погиб на подъёме (${list.length}) — ${names}. Чем меньше потерь, тем меньше призраков.`);
  logEvent('night', `Призраки павших: Малгор поднял ${list.length} павших`, B.x, B.y);
}

// ---------- Такт ----------

function gdTick(dt) {
  const F = Game.foe;
  if (!F) return;
  gdZonesTick(dt);
  const T = F.tiers;
  if (!T || T.none) {
    // ярусы поднимаются, когда герой подходит к шпилю (или глава 6 / поход — см. ниже)
    if (!F.defeated && !T && (Game._gdChk = (Game._gdChk || 0) + dt) > 1) {
      Game._gdChk = 0;
      for (const u of Game.units) if (u.hero && !u.dead && Math.hypot(u.x - F.tx - 1.5, u.y - F.ty - 3) < 46) { gdBuild(F); break; }
    }
    return;
  }
  T.tk = (T.tk || 0) + dt;
  if (T.tk < 0.5) return;
  const st = T.tk; T.tk = 0;
  Game._gdL = gdLights();
  if (F.defeated) { T.ecl = Math.max(0, T.ecl - st * 0.1); return; }
  // бой идёт? — кто-то из стражей/Малгор проснулся
  const fight = Game.raiders.some(N => foeLive(N) && N.woke);
  let heroIn = false;
  for (const u of Game.units) if (u.hero && !u.dead && Math.hypot(u.x - T.cx, u.y - T.cy) < T.r[0] + 6) { heroIn = true; break; }
  T.fightT = fight ? T.fightT + st : Math.max(0, T.fightT - st * 2);
  const want = heroIn ? Math.min(0.95, 0.2 + 0.5 * (T.open / T.n) + T.fightT / 240 + (T.dark || 0)) : 0;
  T.ecl = +(T.ecl + Math.sign(want - T.ecl) * Math.min(Math.abs(want - T.ecl), st * 0.05)).toFixed(3);
  gdFallenTick(T);
  // подсказка у запертых врат
  if (T.open < T.n) for (const u of Game.units) {
    if (!u.hero || u.dead || Game.time - (u._gdHint || -99) < 8) continue;
    const d = Math.hypot(u.x - T.cx, u.y - T.cy);
    if (Math.abs(d - T.r[T.open]) < 2.2) { u._gdHint = Game.time; floater(u.x, u.y - 2.4, `Врата заперты: победи ${GD_KINDS[T.kinds[T.open]].name.toLowerCase().replace('страж', 'стража')}`, '#e0c8ff'); }
  }
}

// ---------- Подключение ----------

FSPEC.bonem = { name: 'Костяной прислужник', mhp: 18, dmg: [2, 4], cd: 1.4, rng: 1.4, spd: 2.3, parry: 0, xp: 12, sz: 7, draw: (c, N) => gdDrawBone(c, N) };
FSPEC.echo = { name: 'Призрак павшего', mhp: 40, dmg: [5, 9], cd: 1.5, rng: 1.5, spd: 2.4, parry: 0.05, xp: 25, sz: 8, draw: (c, N) => gdDrawEcho(c, N) };
FSPEC.ftower = { name: 'Магическая башня', mhp: 110, xp: 70, sz: 10, big: true, still: true, parry: 0, ai: rdTower, draw: (c, N) => gdDrawTower(c, N), drop: [['magicstone', 1, 0.7], ['mana', 1, 0.4]] };
for (const k of GD_ORDER) {
  const G = GD_KINDS[k];
  FSPEC['g_' + k] = { name: G.name, mhp: G.mhp, dmg: G.dmg, cd: G.cd, rng: k === 'golem' ? 2.1 : 1.8, spd: G.spd, parry: k === 'shadow' ? 0.15 : 0.05, xp: 260, sz: k === 'golem' ? 16 : 12,
    big: true, gk: k, ai: rdGuard, draw: (c, N) => gdDrawGuard(c, N), bar: (c, N, px, py) => gdGuardBar(c, N, px, py),
    drop: [['gold', 6, 1], ['magicstone', 2, 1], ['mana', 1, 0.6]] };
}

{
  const _fk = foeKill;
  foeKill = function (N, killer) {
    const was = foeLive(N);
    _fk(N, killer);
    if (was && !foeLive(N)) {
      if (N.gi != null) gdGuardDown(N, killer);
      else if (N.k === 'ftower' && gdT()) { const t = gdT().towers[N.tj]; if (t) t.hp = 0; toast('Магическая башня разрушена!'); }
    }
  };
  const _sb = foeSpawnBoss;
  foeSpawnBoss = function (F) { if (F.tiers && !F.tiers.none && F.tiers.open < F.tiers.n) return; _sb(F); };
  const _ph = foePhase;
  foePhase = function (N, ph) { _ph(N, ph); if (ph === 3) gdEcho(N); };
  const _bd = foeBossDown;
  foeBossDown = function (N, killer) {
    _bd(N, killer);
    const T = gdT();
    for (const M of Game.raiders) if (M.k === 'ftower' && foeLive(M)) { M.noDrop = true; M.st = 'die'; M.dt = 0; }
    Game.foeZones.length = 0;
    if (T && !T.none && T.clean) {
      const tx = Math.floor(N.x), ty = Math.floor(N.y), o = randomFreeNear(tx, ty, 1, 3, (x, y) => isWalkable(x, y)) || [tx, ty];
      dropPile(o[0], o[1], 'gold', 20);
      toast('Чистая победа: на подъёме никто не пал! Малгор оставил ещё золота.');
    }
  };
  // глава 6 и поход поднимают ярусы сразу
  const _eoc = enemyOnChapter;
  enemyOnChapter = function (n) { if (n >= 6 && Game.foe && !Game.foe.defeated && !isMirror()) gdBuild(Game.foe); _eoc(n); };
  if (typeof spireGo === 'function') {
    const _sg = spireGo;
    spireGo = function () { if (Game.foe && !Game.foe.defeated && !isMirror()) gdBuild(Game.foe); _sg(); };
  }
  // герой во тьме видит хуже: чаще промахивается
  const _strike = strike;
  strike = function (u, f) {
    if (f && f.kind === 'foe' && u && foeLive(f.o)) {
      const d = gdDarkAt(u.x, u.y);
      if (d > 0.2 && Math.random() < 0.3 * d) { floater(f.o.x, f.o.y - 2, 'Во тьме мимо!', '#c8b8e8'); foeProvoke(f.o, u); return; }
    }
    return _strike(u, f);
  };
  // тап за запертыми вратами — подсказка и бой со стражем
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    const T = gdT(), h = Game.hero;
    if (T && !T.none && T.open < T.n && h && inb(t[0], t[1])) {
      const R = T.r[T.open], dT = Math.hypot(t[0] + 0.5 - T.cx, t[1] + 0.5 - T.cy), dH = Math.hypot(h.x - T.cx, h.y - T.cy);
      if (dT < R - 0.5 && dH > R) {
        const G = guardsCurrent(), K = GD_KINDS[T.kinds[T.open]];
        toast(`Врата заперты: победи ${K.name.toLowerCase().replace('страж', 'стража')}`);
        if (G) return { kind: 'attack', f: { kind: 'foe', o: G }, tx: Math.floor(G.x), ty: Math.floor(G.y), label: 'Бой: ' + K.name };
      }
    }
    return _rc(t);
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.foeZones = []; Game._gdL = []; };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser(), T = gdT();
    if (s.fo && T) {
      if (T.none) s.fo.tr = { none: 1 };
      else {
        const hp = T.homes.map((h, i) => { const N = Game.raiders.find(M => M.gi === i && foeLive(M)); return N ? Math.round(N.hp) : 0; });
        T.towers.forEach((t, j) => { if (t.hp !== 0) { const N = Game.raiders.find(M => M.tj === j && M.k === 'ftower' && foeLive(M)); t.hp = N ? Math.round(N.hp) : t.hp; } });
        s.fo.tr = { cx: T.cx, cy: T.cy, n: T.n, o: T.open, r: T.r, k: T.kinds, a0: T.a0, h: T.homes, tw: T.towers, g: T.gates, s: T.seals, f: T.fallen, cl: T.clean, hp, e: T.ecl, ft: Math.round(T.fightT) };
      }
    }
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    Game.foeZones = [];
    const F = Game.foe, o = s.fo && s.fo.tr;
    if (!F || !o) return;
    if (o.none) { F.tiers = { n: 0, open: 0, none: 1 }; return; }
    F.tiers = { cx: o.cx, cy: o.cy, n: o.n, open: o.o, r: o.r, kinds: o.k, a0: o.a0, homes: o.h, towers: o.tw || [], gates: o.g || [], seals: o.s || 0, fallen: o.f || [], clean: o.cl ?? 1, ecl: o.e || 0, fightT: o.ft || 0 };
    for (let i = F.tiers.open; i < F.tiers.n; i++) for (const k of F.tiers.gates[i] || []) if (!World.bmap[k]) World.bmap[k] = -1;
    PF.regT = -1e9;
    if (isMirror() || F.defeated) return;
    gdHideBoss(F);
    gdSpawnAll(F, o.hp);
  };
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) gdTick(dt); };
  const _fm = foeMirror;
  foeMirror = function () {
    const m = _fm(), T = gdT();
    if (m && T) m.tiers = T.none ? { none: 1, n: 0, open: 0 } : { cx: T.cx, cy: T.cy, n: T.n, open: T.open, r: T.r, kinds: T.kinds, homes: T.homes, ecl: T.ecl, seals: T.seals, fallen: T.fallen.length, clean: T.clean };
    return m;
  };
}
function foeMirrorZones() { return Game.foeZones.map(z => ({ __id: z.id, id: z.id, x: +z.x.toFixed(2), y: +z.y.toFixed(2), r: z.r, t: +z.t.toFixed(2), dur: z.dur, hue: z.hue, done: z.done })); }

// цель главы 6
function guardsGoal() {
  if (foeDefeated()) return { t: 'Победить стражей Чёрного шпиля', cur: guardsTotal(), need: guardsTotal() };
  const T = gdT(), nx = T && !T.none && T.open < T.n ? ' (дальше: ' + GD_KINDS[T.kinds[T.open]].name.toLowerCase() + ')' : '';
  return { t: 'Победить стражей Чёрного шпиля' + nx, cur: guardsDone(), need: guardsTotal() };
}

// ---------- Рисование ----------

const gdFp = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

// кадр анимации по КАДРЫ.md: покой 6, ходьба 8, атака 9, спец (каст) 6, удар по нему 4, смерть 9
function gdFrame(N) {
  const t = Game.time;
  if (N.st === 'die') return ['die', Math.min(8, Math.floor(N.dt / 0.2))];
  if (t - (N.hurtT || -9) < 0.32) return ['hurt', Math.min(3, Math.floor((t - N.hurtT) / 0.08))];
  if (N.st === 'atk' && N.atkT < 0.56) return ['atk', Math.min(8, Math.floor(N.atkT / 0.0623))];
  if (N.sk || N.st === 'cast') return ['cast', Math.min(5, Math.floor((N.skT || 0) / Math.max(0.1, N.skW || 0.8) * 6)) % 6];
  if (N.st === 'chase') return ['walk', Math.floor(N.ph * 1.2) % 8];
  return ['idle', Math.floor((t + (N.id % 7) * 0.13) / 0.2) % 6];
}

// фигура стража: общий скелет позы + облик по стихии
function gdDrawGuard(c, N) {
  const k = N.gk || (FSPEC[N.k] && FSPEC[N.k].gk), G = GD_KINDS[k], [an, f] = gdFrame(N), t = Game.time;
  const golem = k === 'golem', S = golem ? 1.5 : 1.25;
  const W8 = [0, 1, 1, 0, 0, -1, -1, 0];                         // шаг: смещение ноги
  const legA = an === 'walk' ? W8[f] : 0, legB = an === 'walk' ? -W8[f] : 0;
  const breath = an === 'idle' ? [0, 0, -1, -1, 0, 0][f] : 0;
  const bob = (an === 'walk' ? (f % 4 === 1 || f % 4 === 2 ? -1 : 0) : 0) + breath;
  const lean = an === 'hurt' ? [-2, -3, -2, -1][f] : 0;
  // атака 9: замах 0–2, удар 3–5, возврат 6–8
  const arm = an === 'atk' ? [-0.6, -1.4, -2.2, -0.4, 0.9, 1.3, 0.9, 0.4, 0][f] : an === 'cast' ? -1.8 - 0.25 * Math.sin(f) : an === 'hurt' ? 0.6 : -0.3 + breath * 0.1;
  c.save();
  c.scale(S, S);
  if (an === 'die') { c.globalAlpha *= Math.max(0, 1 - f / 9); c.rotate(-Math.min(1.4, f * 0.18)); c.translate(0, f * 0.8); }
  c.translate(lean, bob);
  const P = {
    fire:   { body: '#5a2a1a', rim: '#a8482a', head: '#2a1410', eye: '#ffe070', acc: '#ff9a3a' },
    ice:    { body: '#3a5a7a', rim: '#8ac8f0', head: '#24384e', eye: '#e8ffff', acc: '#cfefff' },
    bone:   { body: '#6a6458', rim: '#d8d0b8', head: '#e8e0c8', eye: '#9cff66', acc: '#f0ead0' },
    shadow: { body: '#16102c', rim: '#3a2a6a', head: '#0a0818', eye: '#d8b8ff', acc: '#b07cff' },
    golem:  { body: '#4a4458', rim: '#7a7290', head: '#3a3448', eye: '#c08cff', acc: '#b07cff' },
  }[k];
  if (N.veil) c.globalAlpha *= 0.45;
  // ноги
  gdFp(c, -5, -6 + Math.min(0, legA), 4, 6 - Math.min(0, legA), P.body); gdFp(c, 1, -6 + Math.min(0, legB), 4, 6 - Math.min(0, legB), P.body);
  // торс
  const tw = golem ? 14 : 11, th = golem ? 14 : 12;
  gdFp(c, -tw / 2, -6 - th, tw, th, P.body); gdFp(c, tw / 2 - 3, -6 - th, 3, th, P.rim); gdFp(c, -tw / 2, -6 - th, tw, 2, P.rim);
  if (k === 'bone') for (let i = 0; i < 3; i++) gdFp(c, -4, -15 + i * 3, 8, 1, P.acc);           // рёбра
  if (k === 'golem') { gdFp(c, -2, -14, 4, 4, P.acc); gdFp(c, -6, -10, 2, 2, P.acc); gdFp(c, 4, -17, 2, 2, P.acc); }   // руны
  // голова
  const hy = -6 - th - 7;
  gdFp(c, -4, hy, 8, 7, P.head);
  gdFp(c, -2, hy + 3, 2, 1, P.eye); gdFp(c, 1, hy + 3, 2, 1, P.eye);
  if (k === 'fire') for (let i = 0; i < 4; i++) gdFp(c, -4 + i * 2, hy - 3 - ((Math.floor(t * 10) + i) % 3), 2, 3 + ((i + Math.floor(t * 8)) % 2), i % 2 ? '#ffd070' : '#ff7a2a');
  if (k === 'ice') { gdFp(c, -5, hy - 3, 2, 4, P.acc); gdFp(c, -1, hy - 5, 2, 5, P.acc); gdFp(c, 3, hy - 3, 2, 4, P.acc); }
  if (k === 'bone') { gdFp(c, -3, hy + 5, 6, 1, '#4a463c'); gdFp(c, -5, hy - 2, 2, 3, P.acc); gdFp(c, 3, hy - 2, 2, 3, P.acc); }
  if (k === 'shadow') { for (let i = -2; i <= 2; i++) gdFp(c, i * 3 - 1, -4 + ((Math.floor(t * 6) + i) & 1), 2, 4, '#0a0818'); gdFp(c, -5, hy - 2, 10, 3, P.rim); }
  if (k === 'golem') { gdFp(c, -5, hy - 1, 10, 2, P.rim); }
  // рука с оружием
  c.save(); c.translate(tw / 2 - 1, -6 - th + 3); c.rotate(arm);
  gdFp(c, -1, -1, 3, 7, P.rim);
  if (k === 'fire') { gdFp(c, 0, 5, 2, 9, '#3a2a20'); gdFp(c, -1, 13, 4, 3, '#ffb040'); }
  else if (k === 'ice') { gdFp(c, 0, 5, 2, 12, '#cfefff'); gdFp(c, 1, 5, 1, 12, '#ffffff'); }
  else if (k === 'bone') { gdFp(c, 0, 5, 2, 10, '#e8e0c8'); gdFp(c, -2, 14, 6, 3, '#e8e0c8'); }
  else if (k === 'shadow') { gdFp(c, 0, 5, 1, 12, '#b07cff'); gdFp(c, 1, 5, 1, 10, '#d8b8ff'); }
  else { gdFp(c, -2, 5, 6, 6, P.body); gdFp(c, -1, 6, 4, 4, P.rim); }
  c.restore();
  // вторая рука; на касте поднята, светится
  c.save(); c.translate(-tw / 2 + 1, -6 - th + 3); c.rotate(an === 'cast' ? 2.6 : -arm * 0.4);
  gdFp(c, -2, -1, 3, 7, P.body);
  if (an === 'cast') { gdFp(c, -2, 6, 3, 3, P.acc); }
  c.restore();
  c.restore();
  // сияние стихии и уязвимость
  c.save(); c.globalCompositeOperation = 'lighter';
  const rr = an === 'cast' ? 26 : 16, g = c.createRadialGradient(0, -22 * S, 0, 0, -22 * S, rr);
  g.addColorStop(0, `rgba(${G.hue},${an === 'cast' ? 0.45 : 0.22})`); g.addColorStop(1, `rgba(${G.hue},0)`);
  c.fillStyle = g; c.fillRect(-rr, -22 * S - rr, rr * 2, rr * 2);
  if (N.vul || N.vulT > Game.time) { c.strokeStyle = 'rgba(255,224,112,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, 10 * S, 3 * S, 0, 0, 7); c.stroke(); }
  c.restore();
}

function gdGuardBar(c, N, px, py) {
  if (!N.woke && N.hp >= N.mhp - 0.5) return;
  const G = GD_KINDS[N.gk || FSPEC[N.k].gk];
  foeDrawBar(c, N, px, py - (N.gk === 'golem' ? 62 : 54), true);
  c.save(); c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffe0c0';
  c.fillText(`${G.name} · ${G.who}`, px, py - (N.gk === 'golem' ? 68 : 60)); c.restore();
  if (N.shield) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(200,240,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.ellipse(px, py - 22, 16, 24, 0, 0, 7); c.stroke(); c.restore(); }
}

function gdDrawBone(c, N) {
  const [an, f] = gdFrame(N), w = an === 'walk' ? [0, 1, 1, 0, 0, -1, -1, 0][f] : 0;
  const arm = an === 'atk' ? [-0.6, -1.4, -2.2, -0.4, 0.9, 1.3, 0.9, 0.4, 0][f] : -0.3;
  if (an === 'die') { c.globalAlpha *= Math.max(0, 1 - f / 9); c.translate(0, f * 0.6); }
  gdFp(c, -3, -5 + Math.min(0, w), 1, 5, '#d8d0b8'); gdFp(c, 2, -5 + Math.min(0, -w), 1, 5, '#d8d0b8');
  gdFp(c, -3, -12, 6, 7, 'rgba(0,0,0,0)'); gdFp(c, -1, -12, 2, 7, '#d8d0b8');
  for (let i = 0; i < 3; i++) gdFp(c, -3, -11 + i * 2, 6, 1, '#e8e0c8');
  gdFp(c, -3, -18, 6, 6, '#e8e0c8'); gdFp(c, -2, -16, 1, 1, '#9cff66'); gdFp(c, 1, -16, 1, 1, '#9cff66'); gdFp(c, -2, -13, 4, 1, '#6a6458');
  c.save(); c.translate(3, -11); c.rotate(arm); gdFp(c, 0, 0, 1, 5, '#d8d0b8'); gdFp(c, 0, 4, 1, 6, '#b8b4a0'); c.restore();
}

// эхо павших рисуется в echoart.js (уникальные призраки, кэш кадров)

function gdDrawTower(c, N) {
  const t = Game.time, dead = N.st === 'die';
  if (dead) { c.globalAlpha *= Math.max(0, 1 - N.dt / 3); c.translate(0, Math.min(10, N.dt * 6)); }
  gdFp(c, -7, -6, 14, 6, '#15112c'); gdFp(c, -6, -34, 12, 28, '#2a2452'); gdFp(c, 2, -34, 4, 28, '#4a3e88');
  for (let y = -30; y < -6; y += 6) gdFp(c, -6, y, 12, 1, 'rgba(10,8,30,0.6)');
  gdFp(c, -8, -38, 16, 4, '#26204a'); gdFp(c, -8, -38, 16, 1, '#6a5ab8');
  const chg = Math.min(1, (N.chg || 0) / 0.7), cy = -46 + Math.sin(t * 2 + N.id) * 1.5;
  c.save(); c.globalCompositeOperation = 'lighter';
  const r = 10 + chg * 14, g = c.createRadialGradient(0, cy, 0, 0, cy, r);
  g.addColorStop(0, `rgba(190,120,255,${0.45 + 0.5 * chg})`); g.addColorStop(1, 'rgba(170,90,255,0)');
  c.fillStyle = g; c.fillRect(-r, cy - r, r * 2, r * 2);
  c.restore();
  c.fillStyle = chg > 0 ? '#f0d8ff' : '#c08cff';
  c.beginPath(); c.moveTo(0, cy - 6); c.lineTo(4, cy); c.lineTo(0, cy + 6); c.lineTo(-4, cy); c.fill();
}

// врата-кольца (рисуются по геометрии — так же и у клиента кооператива)
const GD_DRAW = { key: '', cells: [] };
function gdGateCells(T) {
  const key = T.cx + ',' + T.cy + ',' + T.r.join(',');
  if (GD_DRAW.key === key) return GD_DRAW.cells;
  const cells = [];
  T.r.forEach((R, i) => {
    for (let y = Math.floor(T.cy - R - 2); y <= T.cy + R + 2; y++) for (let x = Math.floor(T.cx - R - 2); x <= T.cx + R + 2; x++) {
      if (!inb(x, y) || Math.abs(Math.hypot(x + 0.5 - T.cx, y + 0.5 - T.cy) - R) > 0.8 || World.terrain[idx(x, y)] === T_WATER) continue;
      cells.push([x, y, i]);
    }
  });
  GD_DRAW.key = key; GD_DRAW.cells = cells;
  return cells;
}
// врата — сплошная низкая стена из тёмных блоков, над ней дрожит фиолетовая завеса
function gdDrawGate(c, x, y, i) {
  const t = Game.time, px = x * TILE, py = y * TILE + 26, h = (x * 7 + y * 13) % 3;
  gdFp(c, px - 1, py - 13 - h, TILE + 2, 13 + h, '#241e48');
  gdFp(c, px - 1, py - 13 - h, TILE + 2, 2, '#4a3e88'); gdFp(c, px - 1, py - 2, TILE + 2, 2, '#15112c');
  gdFp(c, px + 10 + h * 3, py - 11 - h, 1, 9 + h, '#15112c'); gdFp(c, px + 1, py - 7, 9 + h * 3, 1, '#15112c');
  const a = 0.5 + 0.5 * Math.sin(t * 3 + x * 0.7 + y * 0.5);
  c.save(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = `rgba(176,124,255,${0.1 + 0.12 * a})`; c.fillRect(px, py - 27 - h, TILE, 14);
  c.fillStyle = `rgba(210,170,255,${0.3 * a})`; c.fillRect(px, py - 14 - h, TILE, 1);
  c.restore();
}
function gdDrawZone(c, z) {
  const k = Math.min(1, z.t / z.dur), px = z.x * TILE, py = z.y * TILE, R = z.r * TILE;
  c.save();
  if (!z.done) {
    c.fillStyle = `rgba(${z.hue},${0.08 + 0.18 * k})`; c.beginPath(); c.ellipse(px, py, R, R * 0.6, 0, 0, 7); c.fill();
    c.strokeStyle = `rgba(${z.hue},0.85)`; c.lineWidth = 1.5; c.beginPath(); c.ellipse(px, py, R, R * 0.6, 0, 0, 7); c.stroke();
    c.fillStyle = `rgba(${z.hue},0.35)`; c.beginPath(); c.ellipse(px, py, R * k, R * 0.6 * k, 0, 0, 7); c.fill();
  } else {
    const a = Math.max(0, 1 - (z.t - z.dur) / 0.35);
    c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(${z.hue},${0.5 * a})`; c.beginPath(); c.ellipse(px, py, R * 1.1, R * 0.66, 0, 0, 7); c.fill();
  }
  c.restore();
}

// затмение: тьма и туман над ярусами, свет вырезает дыры
const GD_ECL = { cv: null };
function gdDrawEclipse(c) {
  const T = gdT();
  if (!T || T.none || !(T.ecl > 0.02) || typeof document === 'undefined') return;
  const R0 = T.r[0] + 7, S = 16, size = Math.ceil(R0 * 2 * TILE / S);
  if (!GD_ECL.cv) GD_ECL.cv = document.createElement('canvas');
  const cv = GD_ECL.cv;
  if (cv.width !== size) { cv.width = size; cv.height = size; }
  const l = cv.getContext('2d'), m = size / 2, e = T.ecl, t = Game.time;
  l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, size, size);
  const g = l.createRadialGradient(m, m, m * 0.55, m, m, m);
  g.addColorStop(0, `rgba(10,5,24,${0.82 * e})`); g.addColorStop(1, 'rgba(10,5,24,0)');
  l.fillStyle = g; l.fillRect(0, 0, size, size);
  for (let i = 0; i < 7; i++) {                          // туман плывёт кругами
    const a = t * 0.05 * (i % 2 ? 1 : -1) + i * 0.9, rr = m * (0.25 + 0.1 * i), fx = m + Math.cos(a) * rr, fy = m + Math.sin(a) * rr * 0.7;
    const fg = l.createRadialGradient(fx, fy, 0, fx, fy, m * 0.3);
    fg.addColorStop(0, `rgba(70,50,110,${0.22 * e})`); fg.addColorStop(1, 'rgba(70,50,110,0)');
    l.fillStyle = fg; l.fillRect(fx - m * 0.3, fy - m * 0.3, m * 0.6, m * 0.6);
  }
  l.globalCompositeOperation = 'destination-out';
  const L = isMirror() ? gdLights() : Game._gdL || [];
  const k = TILE / S, ox = T.cx - R0, oy = T.cy - R0;
  for (const [x, y, r] of L) {
    const px = (x - ox) * k, py = (y - oy) * k, rp = r * k * (0.95 + 0.05 * Math.sin(t * 7 + x));
    const lg = l.createRadialGradient(px, py, 0, px, py, rp);
    lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(0.6, 'rgba(0,0,0,0.8)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = lg; l.fillRect(px - rp, py - rp, rp * 2, rp * 2);
  }
  c.drawImage(cv, ox * TILE, oy * TILE, size * S, size * S);
}

{
  const _ds = drawSkeletons;
  drawSkeletons = function (list, c, x0, y0, x1, y1) {
    _ds(list, c, x0, y0, x1, y1);
    const T = gdT();
    if (T && !T.none && T.open < T.n) for (const [x, y, i] of gdGateCells(T)) {
      if (i < T.open || x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
      list.push([y + 0.9, () => gdDrawGate(c, x, y, i)]);
    }
    for (const z of Game.foeZones || []) if (z.x > x0 - 4 && z.x < x1 + 4 && z.y > y0 - 4 && z.y < y1 + 4) list.push([z.y - 0.6, () => gdDrawZone(c, z)]);
  };
  const _dn = drawNight;
  drawNight = function (c, x0, y0, x1, y1) {
    _dn(c, x0, y0, x1, y1);
    try { gdDrawEclipse(c); } catch (e) { if (!gdDrawEclipse.err) { gdDrawEclipse.err = 1; console.error(e); } }
  };
}
