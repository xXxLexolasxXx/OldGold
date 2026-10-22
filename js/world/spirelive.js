'use strict';
// Подъём к Чёрному шпилю, этап 3 (МАЛГОР_ОСТАЛОСЬ.md): «живая башня».
// Каждый ярус — своя стихия, по стражу яруса: огонь — горящий пол, лёд — ледяной ветер (сдувает вдоль кольца),
// кости — шипы из плит, тени — лужи тьмы (в них нечисть бьёт как в полном затмении), голем — камнепад
// и каменные платформы (на платформе камни не достают). Ловушки дешёвые: стоят на месте, фаза — функция
// времени (Game.time + сдвиг), поэтому кооп-клиент рисует их сам, без потока данных. Кадры по КАДРЫ.md:
// взвод 4, срабатывание 6, спад 4. Ловушка не добивает: герой и бойцы остаются хотя бы с 1 HP.
// Контрольные точки: на месте павшего стража загорается мини-костёр — лечит и даёт отдых (мана/ярость),
// внутри нечисть не выбирает целей (безопасная зона, как у большого костра), ловушки рядом спят.
// Павший герой очухивается у самого глубокого костра. Короткий путь: постоял у костра первого яруса —
// тайная тропа гномов ведёт сразу к самому глубокому костру (с отрядом и фонарщиком).
// Считается там же, где вся игра (в кооперативе — на сервере). Подключается после ascent.js.

const LV_EL = {
  fire:   { k: 'fire',  name: 'Ярус огня: пол горит — обходите решётки!',            P: 4.2, act: 1.0, r: 1.0, dmg: [4, 6] },
  ice:    { k: 'ice',   name: 'Ярус льда: ледяной ветер сдувает вдоль кольца!',      P: 5.0, act: 0.9, r: 1.4, dmg: [2, 3] },
  bone:   { k: 'spike', name: 'Ярус костей: из плит бьют шипы!',                     P: 3.4, act: 0.6, r: 0.9, dmg: [5, 7] },
  shadow: { k: 'dark',  name: 'Ярус теней: в лужах тьмы нечисть бьёт сильнее!',      P: 6.0, act: 2.4, r: 1.6, dmg: [2, 3] },
  golem:  { k: 'rock',  name: 'Ярус голема: камнепад! Прячьтесь на плитах.',         P: 5.4, act: 0.6, r: 1.3, dmg: [6, 9] },
};
const LV_WARN = 0.8, LV_END = 0.48;          // взвод 4 кадра по 0,2 с, спад 4 по 0,12 с; срабатывание — 6 кадров на act
const LV_CAMP_R = 3;                          // безопасная зона мини-костра
const LV_SHORT_T = 2.5;                       // сколько стоять у костра первого яруса, чтобы пойти тайной тропой

const lvT = () => { const T = gdT(); return T && !T.none && T.lv ? T : null; };
const lvEl = T => i => LV_EL[T.kinds[i]] || LV_EL.fire;
// ярус точки: 0 — снаружи внешних врат, i — между кольцами i-1 и i, n — у самого шпиля
function lvTierAt(T, x, y) {
  const d = Math.hypot(x - T.cx, y - T.cy);
  let i = 0;
  while (i < T.n && d < T.r[i]) i++;
  return i;
}
function lvInCamp(x, y, r) {
  const T = lvT();
  if (!T) return null;
  for (const cp of T.lv.camps) if (Math.hypot(cp.p[0] - x, cp.p[1] - y) <= (r || LV_CAMP_R)) return cp;
  return null;
}
// фаза ловушки: ['idle'|'warn'|'act'|'end', кадр, номер цикла]
function lvPhase(tr) {
  const E = LV_EL[tr.e], s0 = Game.time + tr.o, cyc = Math.floor(s0 / E.P), s = s0 - cyc * E.P;
  if (s < LV_WARN) return ['warn', Math.min(3, Math.floor(s / 0.2)), cyc];
  if (s < LV_WARN + E.act) return ['act', Math.min(5, Math.floor((s - LV_WARN) / E.act * 6)), cyc];
  if (s < LV_WARN + E.act + LV_END) return ['end', Math.min(3, Math.floor((s - LV_WARN - E.act) / 0.12)), cyc];
  return ['idle', 0, cyc];
}

// ---------- Устройство ----------

function lvSetup(T) {
  if (T.lv) return;
  const L = T.lv = { traps: [], plats: [], camps: [], seen: [] };
  const busy = [];
  for (const h of T.homes) if (h) busy.push([h[0], h[1], 3.5]);
  for (const t of T.towers) if (t.p) busy.push([t.p[0], t.p[1], 2.5]);
  if (T.as) { for (const cg of T.as.cages) busy.push([cg.p[0], cg.p[1], 2.5]); if (T.as.post) busy.push([T.as.post[0], T.as.post[1], 3]); }
  const free = (x, y, r) => busy.every(b => Math.hypot(b[0] - x, b[1] - y) >= b[2] + r);
  for (let i = 0; i < T.n; i++) {
    const key = T.kinds[i], E = LV_EL[key] || LV_EL.fire;
    const lo = i ? T.r[i] + 1.3 : T.r[0] + 2, hi = i ? T.r[i - 1] - 1.3 : T.r[0] + 6.5;
    if (hi - lo < 0.5) continue;
    const want = 3 + (i ? 1 : 0) + (i >= 3 ? 1 : 0);
    let made = 0;
    for (let j = 0; j < want * 3 && made < want; j++) {
      const rad = j % 2 ? hi : lo + (hi - lo) * 0.35, side = j % 2 ? 1 : -1;
      const a = T.a0 + side * (0.35 + Math.floor(j / 2) * 0.32) * Math.min(1, 10 / rad);
      const p = gdSpot(T.cx + Math.cos(a) * rad, T.cy + Math.sin(a) * rad, 1);
      if (!p || !free(p[0], p[1], E.r) || lvTierAt(T, p[0], p[1]) !== i) continue;
      L.traps.push({ i, e: key, p, o: +((made * 1.37 + i * 0.71) % E.P).toFixed(2), w: i % 2 ? 1 : -1 });
      busy.push([p[0], p[1], E.r + 0.6]);
      made++;
      if (E.k === 'rock') {                    // плита рядом с камнепадом: на ней камни не достают
        const b = a + 2.8 / rad * (j % 2 ? -1 : 1), q = gdSpot(T.cx + Math.cos(b) * rad, T.cy + Math.sin(b) * rad, 1);
        if (q && Math.hypot(q[0] - p[0], q[1] - p[1]) > E.r + 0.4 && free(q[0], q[1], 0.6)) { L.plats.push({ i, p: q }); busy.push([q[0], q[1], 1]); }
      }
    }
  }
}

// мини-костёр на месте павшего стража
function lvCamp(T, N) {
  if (!T.lv || T.lv.camps.some(cp => cp.i === N.gi)) return;
  const h = N.home || [N.x, N.y], p = gdSpot(h[0], h[1], 3);
  if (!p) return;
  T.lv.camps.push({ i: N.gi, p, t0: +Game.time.toFixed(1) });
  T.lv.camps.sort((a, b) => a.i - b.i);
  floater(p[0], p[1] - 2.4, 'Костёр-привал: лечение и отдых', '#ffd070');
  logEvent('night', `На ярусе ${N.gi + 1} загорелся костёр-привал`, p[0], p[1]);
}
const lvDeep = T => T.lv.camps.length ? T.lv.camps[T.lv.camps.length - 1] : null;

// ---------- Такт ----------

function lvHurt(u, n) {
  if (u.hero) { const H = u.hero; if (!(H.hp > 1) || H.downT > Game.time) return; n = Math.min(n, H.hp - 1); }
  else if (u.rec) { const R = u.rec; if (R.hp != null && R.hp <= 1) return; if (R.hp != null) n = Math.min(n, R.hp - 1); }
  else if (u.lamp) n = Math.min(n / 0.6, (u.lampHp - 1) / 0.6);
  if (n < 0.5) return;
  neuHurtUnit(u, n);
  u.ouchUntil = Game.time + 0.4;
}
function lvTrapTick(T) {
  const mul = (T.pw || 1) * Math.pow(gdDiff(), 0.8), dark = [];
  const ppl = Game.units.filter(u => !u.dead && !u.inside && (u.hero || u.rec || u.lamp) && Math.hypot(u.x - T.cx, u.y - T.cy) < T.r[0] + 9);
  if (!ppl.length) { Game._lvDark = dark; return; }
  for (const tr of T.lv.traps) {
    const E = LV_EL[tr.e], [ph, , cyc] = lvPhase(tr);
    if (ph !== 'act') continue;
    if (E.k === 'dark') dark.push(tr);
    if (tr.hc === cyc) continue;
    tr.hc = cyc;
    if (lvInCamp(tr.p[0], tr.p[1], LV_CAMP_R + E.r)) continue;          // у костра ловушки спят
    let near = false;
    for (const u of ppl) {
      const d = Math.hypot(u.x - tr.p[0], u.y - tr.p[1]);
      if (d < 9) near = true;
      if (d > E.r) continue;
      if (E.k === 'rock' && T.lv.plats.some(q => Math.hypot(q.p[0] - u.x, q.p[1] - u.y) < 0.95)) continue;
      lvHurt(u, foeR(E.dmg[0], E.dmg[1]) * mul);
      if (E.k === 'ice') {                     // ветер вдоль кольца: по касательной, только на проходимую клетку
        const a = Math.atan2(u.y - T.cy, u.x - T.cx) + Math.PI / 2 * tr.w, nx = u.x + Math.cos(a) * 1.2, ny = u.y + Math.sin(a) * 1.2;
        if (isWalkable(Math.floor(nx), Math.floor(ny))) { u.x = nx; u.y = ny; }
      }
    }
    if (near) {
      const s = { fire: 'crackle', ice: 'whoosh', spike: 'thud', dark: 'wail', rock: 'thud' }[E.k];
      if (E.k !== 'dark' || cyc % 2 === 0) sfxAt(s, tr.p[0] * TILE, tr.p[1] * TILE, 0.35);
      if (E.k === 'rock') fxBurst(tr.p[0] * TILE, tr.p[1] * TILE, 14, ['#6a6070', '#9a90a0', '#3a3440'], 70, 40, 0.6, 2, 140);
    }
  }
  Game._lvDark = dark;
}
function lvCampTick(T, st) {
  for (const u of Game.units) {
    if (u.dead || u.inside || !(u.hero || u.rec || u.lamp)) continue;
    if (!lvInCamp(u.x, u.y)) continue;
    if (u.hero) { const H = u.hero; if (H.maxhp && H.hp > 0 && !(H.downT > Game.time)) H.hp = Math.min(H.maxhp, H.hp + H.maxhp * 0.06 * st); if (typeof abResAdd === 'function') abResAdd(H, 4 * st); }
    else if (u.rec) arHeal(u, 3 * st);
    else if (u.lamp && u.lampHp < u.lampMax) u.lampHp = Math.min(u.lampMax, u.lampHp + 3 * st);
    if (Game.time - (u._lvRest || -99) > 9) { u._lvRest = Game.time; floater(u.x, u.y - 2.2, 'Привал у костра…', '#ffd8a0'); }
  }
}
// тайная тропа: от костра первого яруса — сразу к самому глубокому
function lvShortcut(T, st) {
  const c0 = T.lv.camps[0], deep = lvDeep(T);
  if (!c0 || !deep || deep === c0) return;
  for (const u of Game.units) {
    if (!u.hero || u.dead || u.inside) continue;
    const idle = !u.cmd && !(u.path && u.path.length) && !(u.hero.downT > Game.time) && Math.hypot(u.x - c0.p[0], u.y - c0.p[1]) < 2.2;
    u._lvSc = idle ? (u._lvSc || 0) + st : 0;
    if (u._lvSc < LV_SHORT_T) continue;
    if (Game.raiders.some(N => foeLive(N) && N.woke && Math.hypot(N.x - u.x, N.y - u.y) < 12)) continue;
    u._lvSc = 0;
    const team = Game.units.filter(m => m !== u && !m.dead && !m.inside && (m.rec || m.lamp) && Math.hypot(m.x - u.x, m.y - u.y) < 5);
    const q = lvCampSpot(T, deep);
    if (!q) continue;
    const go = m => {
      fxBurst(m.x * TILE, m.y * TILE - 8, 10, ['#ffd070', '#8a6a3a'], 50, 40, 0.6, 1.6, 100);
      m.x = q[0]; m.y = q[1]; m.path = null;
    };
    go(u); team.forEach(go);
    floater(u.x, u.y - 2.4, 'Тайная тропа гномов!', '#ffd070');
    toast(`Тайная тропа гномов: отряд у костра яруса ${deep.i + 1}.`);
  }
}
// клетка у костра, откуда есть путь наружу (к старой точке у врат): костёр стража может стоять среди валунов,
// и очнуться в «кармане» значит застрять до конца боя
let LV_CP0 = null;
function lvCampSpot(T, cp) {
  if (cp.sp && isWalkable(Math.floor(cp.sp[0]), Math.floor(cp.sp[1]))) return cp.sp;
  const ref = LV_CP0 && LV_CP0(T);
  if (!ref) return null;
  const cx = Math.floor(cp.p[0]), cy = Math.floor(cp.p[1]), rx = Math.floor(ref[0]), ry = Math.floor(ref[1]);
  for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = cx + dx, y = cy + dy;
    if (!isWalkable(x, y) || !(x === rx && y === ry || findPath(x, y, rx, ry))) continue;
    return (cp.sp = [x + 0.5, y + 0.5]);
  }
  return null;
}
function lvTick(dt) {
  const T = gdT();
  if (!T || T.none || Game.foe.defeated) { Game._lvDark = []; return; }
  if (!T.lv) lvSetup(T);
  T.lv.tk = (T.lv.tk || 0) + dt;
  if (T.lv.tk < 0.1) return;
  const st = T.lv.tk; T.lv.tk = 0;
  lvTrapTick(T);
  T.lv.ct = (T.lv.ct || 0) + st;
  if (T.lv.ct < 0.5) return;
  const cs = T.lv.ct; T.lv.ct = 0;
  lvCampTick(T, cs);
  lvShortcut(T, cs);
  // подсказка при входе на ярус со своей стихией (один раз)
  for (const u of Game.units) {
    if (!u.hero || u.dead) continue;
    const i = lvTierAt(T, u.x, u.y);
    if (i >= T.n || T.lv.seen[i] || Math.hypot(u.x - T.cx, u.y - T.cy) > T.r[0] + 6.5 || !T.lv.traps.some(tr => tr.i === i)) continue;
    T.lv.seen[i] = 1;
    floater(u.x, u.y - 2.6, lvEl(T)(i).name, '#ffe0b0');
  }
}

// ---------- Подключение ----------

{
  const _gb = gdBuild;
  gdBuild = function (F) {
    const had = F.tiers, T = _gb(F);
    if (!had && T && !T.none) lvSetup(T);
    return T;
  };
  const _gd = gdGuardDown;
  gdGuardDown = function (N, killer) {
    _gd(N, killer);
    const T = gdT();
    if (T && !T.none && N.gi != null) { if (!T.lv) lvSetup(T); lvCamp(T, N); }
  };
  // очнуться — у самого глубокого костра (короткий путь назад к бою)
  const _cp = LV_CP0 = asCheckpoint;
  asCheckpoint = function (T) {
    const deep = T.lv && lvDeep(T);
    return deep && lvCampSpot(T, deep) || _cp(T);
  };
  // безопасная зона: у костра нечисть не выбирает целей (как у большого костра)
  const _nb = nearBonfire;
  nearBonfire = function (x, y, r) { return _nb(x, y, r) || !!lvInCamp(x, y, Math.min(r, LV_CAMP_R)); };
  const _gt = gdTargetNear;
  gdTargetNear = function (N, x, y, r) { const b = _gt(N, x, y, r); return b && lvInCamp(b.x, b.y) ? null : b; };
  const _ft = foeTargetNear;
  foeTargetNear = function (N, r) { const b = _ft(N, r); return b && lvInCamp(b.x, b.y) ? null : b; };
  // костры светят в затмении; лужи тьмы — темнота в полную силу
  const _gl = gdLights;
  gdLights = function () { const out = _gl(), T = lvT(); if (T) for (const cp of T.lv.camps) out.push([cp.p[0], cp.p[1], LV_CAMP_R + 0.5]); return out; };
  const _da = gdDarkAt;
  gdDarkAt = function (x, y) {
    const v = _da(x, y), D = Game._lvDark;
    if (D && D.length) for (const tr of D) if (Math.hypot(tr.p[0] - x, tr.p[1] - y) < LV_EL[tr.e].r) return Math.max(v, 0.9);
    return v;
  };
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) lvTick(dt); };
  const _fm = foeMirror;
  foeMirror = function () {
    const m = _fm(), T = lvT();
    if (m && m.tiers && T) m.tiers.lv = { traps: T.lv.traps.map(tr => ({ i: tr.i, e: tr.e, p: tr.p, o: tr.o, w: tr.w })), plats: T.lv.plats, camps: T.lv.camps };
    return m;
  };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser(), T = lvT();
    if (s.fo && s.fo.tr && T) s.fo.tr.lv = { traps: T.lv.traps.map(tr => ({ i: tr.i, e: tr.e, p: tr.p, o: tr.o, w: tr.w })), plats: T.lv.plats, camps: T.lv.camps, seen: T.lv.seen };
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    const T = gdT(), o = s.fo && s.fo.tr && s.fo.tr.lv;
    if (T && !T.none && o) T.lv = Object.assign({ traps: [], plats: [], camps: [], seen: [] }, JSON.parse(JSON.stringify(o)));
    Game._lvDark = [];
  };
  const _ds = drawSkeletons;
  drawSkeletons = function (list, c, x0, y0, x1, y1) {
    _ds(list, c, x0, y0, x1, y1);
    const T = lvT();
    if (!T || Game.foe.defeated && !T.lv.camps.length) return;
    const vis = p => p[0] > x0 - 3 && p[0] < x1 + 3 && p[1] > y0 - 3 && p[1] < y1 + 3;
    if (!Game.foe.defeated) {
      for (const tr of T.lv.traps) if (vis(tr.p)) list.push([tr.p[1] - (tr.e === 'golem' ? -0.2 : 0.7), () => lvDrawTrap(c, T, tr)]);
      for (const q of T.lv.plats) if (vis(q.p)) list.push([q.p[1] - 0.6, () => lvDrawPlat(c, q)]);
    }
    for (const cp of T.lv.camps) if (vis(cp.p)) list.push([cp.p[1], () => lvDrawCamp(c, cp)]);
  };
}

// ---------- Рисование ----------
// Ловушки: взвод 4, срабатывание 6, спад 4 кадра (КАДРЫ.md, эффекты 4–6); костёр — малый огонь, 5 кадров.

const lvFp = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

function lvDrawTrap(c, T, tr) {
  const E = LV_EL[tr.e], [ph, f] = lvPhase(tr), px = Math.round(tr.p[0] * TILE), py = Math.round(tr.p[1] * TILE + 6), R = E.r * TILE;
  c.save(); c.translate(px, py);
  if (E.k === 'fire') {                      // решётка над жаром: тлеет → вспыхивает столбами → дымит
    const glow = ph === 'warn' ? 0.25 + f * 0.18 : ph === 'act' ? 1 : ph === 'end' ? 0.6 - f * 0.15 : 0.15 + 0.05 * Math.sin(Game.time * 3 + tr.o);
    lvFp(c, -12, -6, 24, 12, '#2a1a14');
    lvFp(c, -10, -4, 20, 8, `rgba(255,${110 + Math.round(60 * glow)},40,${0.35 + 0.6 * glow})`);
    for (let x = -11; x <= 9; x += 4) lvFp(c, x, -6, 2, 12, '#4a3a34');
    lvFp(c, -12, -1, 24, 2, '#4a3a34');
    if (ph === 'act') {
      const hs = [8, 16, 22, 20, 14, 9][f];
      c.globalCompositeOperation = 'lighter';
      for (let k = -1; k <= 1; k++) {
        const h = hs - Math.abs(k) * 5 + ((f + k) & 1) * 2;
        lvFp(c, k * 7 - 2, -h, 5, h, 'rgba(255,130,40,0.55)'); lvFp(c, k * 7 - 1, -h + 3, 3, h - 3, 'rgba(255,220,120,0.7)');
      }
    } else if (ph === 'end') for (let k = 0; k < 3; k++) lvFp(c, k * 6 - 7, -8 - f * 4 - k * 2, 3, 3, `rgba(90,80,80,${0.5 - f * 0.12})`);
    else if (ph === 'warn') for (let k = 0; k <= f; k++) lvFp(c, -9 + k * 5, -2 - (k & 1) * 2, 2, 2, '#ffd070');
  } else if (E.k === 'ice') {                // наледь; ветер — полосы позёмки по касательной
    c.fillStyle = 'rgba(200,235,255,0.35)'; c.beginPath(); c.ellipse(0, 0, R, R * 0.55, 0, 0, 7); c.fill();
    lvFp(c, -8, -2, 6, 1, 'rgba(255,255,255,0.6)'); lvFp(c, 3, 2, 5, 1, 'rgba(255,255,255,0.5)');
    const a = Math.atan2(tr.p[1] - T.cy, tr.p[0] - T.cx) + Math.PI / 2 * tr.w, dx = Math.cos(a), dy = Math.sin(a) * 0.55;
    const n = ph === 'warn' ? f + 1 : ph === 'act' ? 6 : ph === 'end' ? 3 - f : 0;
    const run = ph === 'act' ? f * 7 : ph === 'warn' ? f * 2 : 40 + f * 6;
    for (let k = 0; k < n; k++) {
      const s = (k * 13 + run) % 44 - 22, o = ((k * 7) % 5 - 2) * 4;
      c.fillStyle = `rgba(230,248,255,${ph === 'act' ? 0.8 : 0.45})`;
      c.fillRect(Math.round(dx * s - dy * o), Math.round(dy * s + dx * o) - 6, ph === 'act' ? 7 : 3, 1);
    }
  } else if (E.k === 'spike') {              // плита с дырами: острия показываются → бьют → прячутся
    lvFp(c, -11, -5, 22, 10, '#5a5450'); lvFp(c, -11, -5, 22, 1, '#7a746e'); lvFp(c, -11, 4, 22, 1, '#3a3430');
    const up = ph === 'warn' ? f : ph === 'act' ? [9, 11, 11, 11, 10, 9][f] : ph === 'end' ? [7, 5, 3, 1][f] : 0;
    for (let k = 0; k < 6; k++) {
      const x = -9 + (k % 3) * 7 + (k >= 3 ? 3 : 0), y = k >= 3 ? 2 : -2;
      lvFp(c, x, y, 2, 1, '#1a1614');
      if (up) { lvFp(c, x, y - up, 2, up, '#d8d0b8'); lvFp(c, x, y - up, 1, up, '#f0e8d0'); }
    }
    if (ph === 'act' && f < 2) { c.globalCompositeOperation = 'lighter'; lvFp(c, -11, -14, 22, 10, 'rgba(255,240,200,0.25)'); }
  } else if (E.k === 'dark') {               // трещина → лужа тьмы с щупальцами → стягивается
    const k = ph === 'warn' ? (f + 1) / 5 : ph === 'act' ? 1 : ph === 'end' ? 1 - (f + 1) / 5 : 0.12;
    c.fillStyle = `rgba(20,8,40,${0.25 + 0.6 * k})`; c.beginPath(); c.ellipse(0, 0, R * Math.max(0.2, k), R * 0.55 * Math.max(0.2, k), 0, 0, 7); c.fill();
    lvFp(c, -6, 0, 12, 1, `rgba(176,124,255,${0.3 + 0.4 * k})`); lvFp(c, -2, -1, 4, 1, 'rgba(176,124,255,0.6)');
    if (ph === 'act') for (let j = 0; j < 4; j++) {
      const x = Math.round(Math.cos(j * 1.6 + tr.o) * R * 0.6), h = 4 + ((f + j) % 3) * 3;
      lvFp(c, x, -h, 2, h, 'rgba(40,16,70,0.85)'); lvFp(c, x, -h, 1, 1, '#c8a8ff');
    }
  } else if (E.k === 'rock') {               // тень растёт → камень падает → пыль
    lvFp(c, -10, 1, 4, 3, '#5a5260'); lvFp(c, 5, -2, 3, 2, '#5a5260'); lvFp(c, 0, 3, 3, 2, '#4a4450');
    if (ph === 'warn' || ph === 'act' && f < 3) {
      const k = ph === 'warn' ? (f + 1) / 6 : 0.7 + f * 0.1;
      c.fillStyle = `rgba(10,8,20,${0.2 + 0.4 * k})`; c.beginPath(); c.ellipse(0, 0, R * k, R * 0.55 * k, 0, 0, 7); c.fill();
    }
    if (ph === 'act') {
      const y = [-90, -50, -14, 0, 0, 0][f];
      lvFp(c, -7, y - 12, 14, 12, '#6a6070'); lvFp(c, -7, y - 12, 14, 2, '#9a90a0'); lvFp(c, 3, y - 10, 4, 8, '#4a4450');
      if (f >= 3) for (let j = 0; j < 5; j++) lvFp(c, -14 + j * 7, -3 - ((j + f) % 3) * 2 - (f - 3) * 2, 3, 3, `rgba(150,140,150,${0.7 - (f - 3) * 0.2})`);
    } else if (ph === 'end') { lvFp(c, -6, -8 + f * 2, 12, 8 - f * 2, '#6a6070'); for (let j = 0; j < 4; j++) lvFp(c, -12 + j * 8, -6 - f * 2, 3, 2, `rgba(150,140,150,${0.4 - f * 0.1})`); }
  }
  c.restore();
}

function lvDrawPlat(c, q) {
  const px = Math.round(q.p[0] * TILE), py = Math.round(q.p[1] * TILE + 6);
  c.save(); c.translate(px, py);
  lvFp(c, -13, -4, 26, 10, '#3a3440'); lvFp(c, -12, -8, 24, 8, '#7a7086'); lvFp(c, -12, -8, 24, 1, '#a89cb8');
  lvFp(c, -6, -6, 1, 4, '#5a5266'); lvFp(c, 4, -5, 1, 3, '#5a5266');
  lvFp(c, -2, -6, 4, 2, `rgba(176,124,255,${0.35 + 0.2 * Math.sin(Game.time * 2 + q.p[0])})`);     // руна-подсказка
  c.restore();
}

function lvDrawCamp(c, cp) {
  const t = Game.time, f = Math.floor(t / 0.12 + cp.i) % 5, px = Math.round(cp.p[0] * TILE), py = Math.round(cp.p[1] * TILE + 6);
  c.save(); c.translate(px, py);
  c.globalCompositeOperation = 'lighter';
  const g = c.createRadialGradient(0, -4, 0, 0, -4, LV_CAMP_R * TILE * 0.8);
  g.addColorStop(0, 'rgba(255,170,70,0.28)'); g.addColorStop(1, 'rgba(255,140,40,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, -2, LV_CAMP_R * TILE * 0.8, LV_CAMP_R * TILE * 0.45, 0, 0, 7); c.fill();
  c.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; lvFp(c, Math.round(Math.cos(a) * 9) - 2, Math.round(Math.sin(a) * 4) - 1, 4, 3, k & 1 ? '#6a6470' : '#8a8490'); }   // камни
  lvFp(c, -7, -2, 14, 3, '#5a3a22'); lvFp(c, -5, -4, 10, 2, '#7a5232');                      // поленья
  const hs = [9, 11, 12, 10, 8][f], w = [6, 5, 6, 7, 6][f];
  lvFp(c, -w / 2 | 0, -4 - hs, w, hs, '#ff8a2a'); lvFp(c, -2, -4 - hs + 3, 4, hs - 3, '#ffd070'); lvFp(c, -1, -4 - hs + 6, 2, hs - 6, '#fff4c0');
  lvFp(c, ((f * 3) % 7) - 3, -6 - hs - f, 1, 1, '#ffd070');                                // искра
  lvFp(c, 11, -16, 1, 16, '#5a3a22'); lvFp(c, 12, -16, 7, 5, '#b03a2a'); lvFp(c, 12, -16, 7, 1, '#d85a3a');   // флажок привала
  c.restore();
}
