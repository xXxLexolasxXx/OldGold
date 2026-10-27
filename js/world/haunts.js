'use strict';
// Места нечисти и прогон летучих мышей. Подключается после banish.js.
//
// 1) Нечисть живёт «по стихиям и местам»: HAUNTS — таблица «место → существо» с весом по сезонам.
//    Полудница — на полях в зной (земля и солнце), кикимора или водяной — в колодце и у воды (вода),
//    леший — в лесу у лесопилок (дерево), банши — у кладбища (смерть), мыши — из гнёзд: с кладбища,
//    из шахт и каменоломен, иначе с края карты (воздух и камень). Ночь страшнее: чем дальше ночи, тем
//    больше мышей, в долгую ночь — ещё больше; зимой вода дремлет, а мыши спят.
// 2) Летучих мышей можно прогнать, а не убить: клик героя («Прогнать мышь»), изгнание нежити, оберег мага и
//    костёр прогоняют их, стражи гонят сами, остальные гномы — иногда. Прогнанная мышь улетает, и стая
//    возвращается не сразу. Свет костра и фонарей мыши облетают, гнома в свету не трогают (см. «Свет»).

// сезоны как в dilSeason(): 0 весна, 1 лето, 2 осень, 3 зима
const HAUNTS = [
  { place: 'farm',      el: 'земля',   who: 'noon',    when: 'полдень',   s: [0.5, 1, 0.6, 0] },        // Полудница на поле
  { place: 'well',      el: 'вода',    who: 'kik',     when: 'ночь',      s: [0.9, 0.5, 1, 0.3] },      // кикимора в колодце
  { place: 'well',      el: 'вода',    who: 'vod',     when: 'ночь',      s: [0.7, 1, 0.8, 0.3] },      // водяной в колодце
  { place: 'shore',     el: 'вода',    who: 'kik/vod', when: 'ночь',      s: [1, 1, 1, 0.5] },          // у озера: кикимора, водяной и русалка
  { place: 'forest',    el: 'дерево',  who: 'leshy',   when: 'вырубка',   s: [1, 1, 1, 1] },
  { place: 'graveyard', el: 'смерть',  who: 'banshee', when: 'ночь',      s: [1, 1, 1, 1] },
  { place: 'graveyard', el: 'смерть',  who: 'bat',     when: 'ночь',      s: [0.8, 1, 0.9, 0.2], roost: 1 },
  { place: 'mine',      el: 'камень',  who: 'bat',     when: 'ночь',      s: [0.8, 1, 0.9, 0.2], roost: 1 },
  { place: 'edge',      el: 'воздух',  who: 'bat',     when: 'ночь',      s: [0.8, 1, 0.9, 0.2], roost: 0 },
];
const HN = {
  AWAY: 90,                  // сколько стая не возвращается после прогона, с
  SHOO_R: 4.5,               // дальше этого герой уже не достаёт
  WELL_BASE: 0.7,            // шанс, что в колодце поселилось что-то, в обычную ночь
  GUARD: ['warrior', 'archer', 'hero'],
  CAP: 4,                    // больше четырёх мышей разом не бывает, как бы ни была глубока ночь
  LAMP_R: 3.2,               // свет уличного фонаря, клеток (как в mood.js)
  LANTERN: 0.6,              // фонарь в руке: столько налётов мышь бросает, не долетев
};

const hnSeason = () => (typeof dilSeason === 'function' ? dilSeason() : 1);
// вес места/существа в этом сезоне
function hauntW(place, who) {
  const h = HAUNTS.find(x => x.place === place && x.who === who);
  return h ? h.s[hnSeason()] : 0;
}
// чем дальше ночи, тем опаснее: 1 → 1.35 к 8-й ночи; долгая ночь — ещё +20 %
function hauntNightMul() {
  const ni = typeof nightIndex === 'function' ? nightIndex() : 0;
  return (1 + Math.min(0.35, ni * 0.05)) * (typeof isLongNight === 'function' && isLongNight() ? 1.2 : 1);
}

// ---------- Колодцы: в колодце живёт кикимора ИЛИ водяной ----------
function hnWells() { return Game.buildings.filter(b => b.type === 'well' && b.state === 'done' && !b.removed); }
// кто поселился — решает колодец и сезон, а не бросок кубика каждый раз (в одном колодце не живут оба)
function hnWellWho(b) {
  const k = hauntW('well', 'kik'), v = hauntW('well', 'vod');
  const h = ((b.id * 2654435761) >>> 0) / 4294967296;            // колодцу достаётся постоянная «душа»
  return h * (k + v) < k ? 'kik' : 'vod';
}
function hnWellSite(b) {
  const wx = b.x, wy = b.y;
  const land = randomFreeNear(b.doorX, b.doorY, 0, 2, (x, y) => fzLand(x, y) && !World.road[idx(x, y)]) || [b.doorX, b.doorY];
  return { x: land[0], y: land[1], wx, wy, well: true };
}
function hnSpawnWells(F) {
  F.wp = [];
  const mul = hauntNightMul();
  const ws = hnWells().sort((a, c) => a.id - c.id);
  let made = 0;
  const cap = isLongNight() ? 2 : 1;
  for (const b of ws) {
    if (made >= cap) break;
    const who = hnWellWho(b), w = hauntW('well', who);
    if (Math.random() > Math.min(0.95, HN.WELL_BASE * w * mul)) continue;
    const s = hnWellSite(b);
    if (fzNear(F, s, 9)) continue;
    made++;
    if (who === 'kik') F.kik.push({ hx: s.x, hy: s.y, wx: s.wx, wy: s.wy, x: s.wx + 0.5, y: s.wy + 0.5, state: 'hide', t: 0, ph: Math.random() * 9, face: 1, alpha: 0, tgt: 0, sated: false, scan: 0, rest: 0, well: b.id });
    else F.wp.push({ x: s.x, y: s.y, wx: s.wx, wy: s.wy, calm: false, hoard: [], well: b.id, vod: { x: s.wx + 0.5, y: s.wy + 0.5, state: 'hide', t: 0, ph: Math.random() * 9, alpha: 0, face: 1, scan: 0, tgt: 0 }, rus: null });
    logEvent('night', who === 'kik' ? 'В колодце завелась кикимора — за водой лучше ходить засветло' : 'В колодце поселился водяной — вёдра с грузом лучше не ронять', b.doorX, b.doorY);
  }
  return made;
}
// не селить рядом с уже занятым местом
function fzNear(F, s, d) {
  for (const k of F.kik) if (Math.hypot(k.hx - s.x, k.hy - s.y) < d) return true;
  if (F.pond && Math.hypot(F.pond.x - s.x, F.pond.y - s.y) < d) return true;
  return false;
}

{
  // колодезные жильцы — после ночного завода у воды
  const _sp = fzSpawnNight;
  fzSpawnNight = function () {
    _sp();
    const F = fz();
    F.wp = [];
    try { hnSpawnWells(F); } catch (e) { /* без колодцев всё как раньше */ }
  };

  // омуты колодцев тикают тем же кодом, что и озёрный; русалки у колодца нет
  const _st = fzSelfStep;
  fzSelfStep = function (F, dt) {
    _st(F, dt);
    const act = fzDark() > 0.35 && !isDawnNow();
    for (let i = (F.wp || []).length - 1; i >= 0; i--) {
      const P = F.wp[i];
      if (hnPondTick(F, P, dt, act)) F.wp.splice(i, 1);
    }
  };

  // водяной в колодце: тот же fzPondTick, русалку заменяет немая заглушка
  function hnPondTick(F, P, dt, act) {
    const v = P.vod;
    const fake = { vod: v, rus: { ph: 0, t: 0, alpha: 0, state: 'sit', song: 1e9, scan: 1e9, x: v.x, y: v.y }, calm: P.calm, hoard: P.hoard, x: P.x, y: P.y };
    const done = fzPondTick(F, fake, dt, act);
    P.calm = fake.calm; P.hoard = fake.hoard;
    return done;
  }

  // рисуем: кикимора в колодце без камышей, водяной — как на озере
  const _dl = fairy2DrawList;
  fairy2DrawList = function (list, c, x0, y0, x1, y1) {
    _dl(list, c, x0, y0, x1, y1);
    if (!FZ_ON() || !Game.fairy2) return;
    const F = Game.fairy2, vis = (x, y) => x >= x0 - 3 && x <= x1 + 3 && y >= y0 - 4 && y <= y1 + 4;
    for (const P of F.wp || []) if (vis(P.x, P.y) && P.vod.alpha > 0) {
      const v = P.vod;
      list.push([v.y + 0.9, () => {
        fzDrawHi(c, fzVodSprite(v.state === 'grab', Math.floor(v.ph * 2) % 4), v.x, v.y - 0.1 + Math.sin(v.ph * 2) * 0.03, v.alpha, v.face, 4);
      }]);
    }
  };
}

// ---------- Полудница: только в сезон зноя, раз в сутки бросаем кубик ----------
if (typeof fzNoonTick === 'function') {
  const _nt = fzNoonTick;
  fzNoonTick = function (F, dt) {
    const cy = cycleAt(Game.time);
    const mid = EVE_START * 0.5;
    if (!F.noon && F.noonDay !== cy.k && nightAmt() < 0.01 && Math.abs(cy.p - mid) < EVE_START * 0.12) {
      if (Math.random() >= hauntW('farm', 'noon')) { F.noonDay = cy.k; return; }      // сегодня зной не злой
    }
    return _nt(F, dt);
  };
}

// ---------- Мыши: гнёзда ----------
function hnRoosts() {
  const out = [];
  for (const b of Game.buildings) {
    if (b.removed || b.state !== 'done') continue;
    if (b.type === 'graveyard' || b.type === 'quarry' || /mine$/.test(b.type)) out.push({ x: b.doorX, y: b.doorY, type: b.type });
  }
  return out;
}
// откуда прилетает новая мышь: ближайшее к деревне гнездо, иначе из-за края
function batSpawnPoint(cx, cy) {
  const roosts = hnRoosts().sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  const r = roosts[(Math.random() * Math.min(2, roosts.length)) | 0];
  if (r) return { x: r.x + (Math.random() - 0.5) * 3, y: r.y + (Math.random() - 0.5) * 3, roost: r.type };
  const a = Math.random() * Math.PI * 2;
  return { x: cx + Math.cos(a) * 24, y: cy + Math.sin(a) * 18, roost: null };
}
// сколько мышей и как часто: сезон, глубина ночи, долгая ночь, гнёзда рядом
function batCap() {
  const w = hnSeason() === 3 ? 0.5 : 1;
  return Math.max(1, Math.min(HN.CAP, Math.round((3 + (hnRoosts().length ? 1 : 0)) * hauntNightMul() * w - 0.3)));
}
function batRate() {
  const place = hnRoosts().some(r => r.type === 'graveyard') ? 'graveyard' : hnRoosts().length ? 'mine' : 'edge';
  return 0.12 * hauntW(place, 'bat') * hauntNightMul();
}
// стая вернётся не сразу после прогона
const batOpen = () => (Game.batAway || 0) <= Game.time;

// ---------- Свет: мыши его боятся ----------
// Чтобы мыши не стали новой бедой (как совы), против них есть простые средства: костёр и уличные фонари
// держат их на расстоянии, фонарь в руке гнома чаще всего отпугивает, а прогнать мышь можно кликом.
function lampNear(x, y, r) {
  const cx = Math.floor(x), cy = Math.floor(y), R = Math.ceil(r);
  for (let yy = cy - R; yy <= cy + R; yy++) for (let xx = cx - R; xx <= cx + R; xx++) {
    if (!inb(xx, yy)) continue;
    const o = World.obj[idx(xx, yy)];
    if (o && o.t === 'lamp' && !o.out && Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r) return [xx + 0.5, yy + 0.5];
  }
  return null;
}
// источник света рядом с точкой: [x, y] или null
function batLitAt(x, y) {
  for (const b of Game.buildings) if (b.type === 'bonfire' && b.state === 'done' && !b.removed && Math.hypot(b.doorX + 0.5 - x, b.doorY + 0.5 - y) < BONFIRE_SAFE) return [b.doorX + 0.5, b.doorY + 0.5];
  return lampNear(x, y, HN.LAMP_R);
}
// гнома в свету мышь не пугает и не уносит; с фонарём в руке — чаще всего тоже
function batSafe(u) {
  if (nearBonfire(u.x, u.y, BONFIRE_SAFE) || lampNear(u.x, u.y, HN.LAMP_R)) return true;
  return typeof lanternLit === 'function' && lanternLit(u) && Math.random() < HN.LANTERN;
}
// мышь, залетевшая в свет, отворачивает прочь
function batAvoidLight(b) {
  b.litCD = (b.litCD || 0) - 1;
  if (b.litCD > 0) return;
  b.litCD = 8;
  const L = batLitAt(b.x, b.y);
  if (!L) return;
  const dx = b.x - L[0], dy = b.y - L[1], d = Math.hypot(dx, dy) || 1;
  b.tx = b.x + dx / d * 7; b.ty = b.y + dy / d * 7; b.retarget = 1.5;
}
// подсказка игроку — один раз за игру, при первом налёте
function batHint() {
  if (Game.batHint) return;
  Game.batHint = true;
  toast('Летучие мыши боятся света: костёр и фонари держат их подальше. Мышь можно прогнать кликом');
}

// ---------- Прогон ----------
function batShoo(b, who, how) {
  if (!b || b.leave || b.state === 'grab') return false;
  b.leave = true; b.shoo = Game.time; b.spd = (b.spd || 3) * 1.7; b.grabCD = Game.time + 300;
  Game.batAway = Math.max(Game.batAway || 0, Game.time + HN.AWAY);
  floater(b.x, b.y - 1.8, ['Пи-и-и!', 'Кыш-кыш-кыш…', 'Улетаю-улетаю!'][(Math.random() * 3) | 0], '#e8e0f0');
  sfxAt('squeak', b.x * TILE, b.y * TILE, 0.9);
  fxBurst(b.x * TILE, b.y * TILE - b.z, 8, ['#cfc4e0', '#8a7aa0', '#ffffff'], 40, 30, 0.7, 1.6, -30);
  const name = who ? (who.hero ? who.hero.name : unitTitle(who)) : 'Кто-то';
  logEvent('night', `${name} ${how || 'прогнал'} летучую мышь — улетела`, b.x, b.y);
  if (typeof fstat === 'function') fstat('batShoo');
  return true;
}
const batOk = b => b && !b.leave && b.state !== 'grab' && (Game.bats || []).includes(b);
// мышь над клеткой: рисуется выше своей точки на z пикселей — ловим и клик по её силуэту
function batAt(x, y, r) {
  let best = null, bd = r;
  for (const b of Game.bats || []) {
    if (!batOk(b)) continue;
    const lift = (b.z || 30) / TILE;
    for (const o of [0, lift * 0.5, lift]) { const d = Math.hypot(b.x - x, b.y - lift - (y - o)); if (d < bd) { bd = d; best = b; } }
  }
  return best;
}
// все мыши вокруг (изгнание нежити, оберег, костёр)
function batShooAround(h, r) {
  let n = 0;
  for (const b of (Game.bats || []).slice()) if (batOk(b) && Math.hypot(b.x - h.x, b.y - h.y) < r && batShoo(b, h, 'отпугнул')) n++;
  return n;
}

// кто как гонит мышь сам, когда она налетает: страж почти всегда, у костра — смело, остальные иногда
function batShooTry(b, u) {
  if (!batOk(b)) return false;
  let p = HN.GUARD.includes(u.type) ? 0.9 : typeof nearBonfire === 'function' && nearBonfire(u.x, u.y, 7) ? 0.7 : (u.fam && u.fam.age !== undefined && u.fam.age < 14) ? 0.15 : 0.3;
  if (Math.random() >= p) return false;
  u.face = b.x >= u.x ? 1 : -1;
  gesture(u, 'fist', 1.1, b.x);
  floater(u.x, u.y - 1.2, ['Кыш, окаянная!', 'А ну пошла!', 'Кыш!'][(Math.random() * 3) | 0], '#fff2a0');
  return batShoo(b, u, 'отмахнулся и прогнал');
}

function* batShooGen(u, c) {
  const b = c.b;
  for (let tries = 0; tries < 5; tries++) {
    if (!batOk(b)) return;
    if (Math.hypot(b.x - u.x, b.y - u.y) < 3) break;
    const tx = Math.max(1, Math.min(MAP_W - 2, Math.floor(b.x))), ty = Math.max(1, Math.min(MAP_H - 2, Math.floor(b.y)));
    const spot = isWalkable(tx, ty) ? [tx, ty] : (randomFreeNear(tx, ty, 0, 2, (x, y) => isWalkable(x, y)) || null);
    if (!spot) return;
    yield { walk: spot };
  }
  if (!batOk(b)) return;
  if (Math.hypot(b.x - u.x, b.y - u.y) > HN.SHOO_R) { floater(u.x, u.y - 1.6, 'Ушла…', '#cfe6ff'); return; }
  u.face = b.x > u.x ? 1 : -1; u.vdir = 'E';
  floater(u.x, u.y - 1.7, 'Кыш отсюда!', '#ffe9a0');
  u.gest = 'fist'; u.gestUntil = Game.time + 0.8; u.gestFace = u.face;
  yield { wait: 0.5 };
  batShoo(b, u);
}

{
  // клик по мыши
  const _rc = resolveCmd;
  resolveCmd = function (t) {
    const shared = Game.coop || (typeof kitServer === 'function' && kitServer());
    if (inb(t[0], t[1]) && (shared || (typeof hlOn === 'function' && hlOn() && !Game.hero.dead))) {
      const b = batAt(t[0] + 0.5, t[1] + 0.5, 1.2);
      if (b) return { kind: 'shoobat', b, tx: Math.floor(b.x), ty: Math.floor(b.y), label: 'Прогнать мышь' };
    }
    return _rc(t);
  };
  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'shoobat') {
      u.exoUntil = Game.time + 12;
      try { yield* batShooGen(u, c); } finally { u.exoUntil = 0; }
      return;
    }
    yield* _run(u, c);
  };

  // «духи рядом» для способностей: мышь тоже считается (иначе без призраков и скелетов способность отвечает «Врагов рядом нет»)
  const _near = foesNear;
  foesNear = function (x, y, r) {
    const out = _near(x, y, r);
    if (BN.spirit && !out.length) for (const b of Game.bats || []) if (batOk(b) && Math.hypot(b.x - x, b.y - y) < r) { out.push({ kind: 'spirit', o: b }); break; }
    return out;
  };
  const _alive = foeAlive;
  foeAlive = function (f) { return f && f.kind === 'spirit' && f.o && Game.bats && Game.bats.includes(f.o) ? batOk(f.o) : _alive(f); };

  // способности жреца/мага/паладина и большой костёр: заодно прогоняют мышей
  if (typeof bnBanishAround === 'function') {
    const _bb = bnBanishAround;
    bnBanishAround = function (h, r) { return _bb(h, r) + batShooAround(h, Math.max(r, 7)); };
  }
}
