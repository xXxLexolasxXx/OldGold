'use strict';
// Оборона: бой и такт. Стройка стен, ворота, ловушки, дозорный и стражи на башне, поведение нечисти у преград,
// команды кооператива. Рисование — defenseart.js, интерфейс — defenseui.js.

Game.dshots = [];       // стрелы, дротики и вспышки в полёте (зеркалится в коопе)
Game.dtowers = [];      // дозорные башни: стражи, время тревоги (зеркалится в коопе)

const DEF_KILLER = { id: 0, type: 'sentry', x: 0, y: 0, dead: false, inside: null, hero: null, rec: null };   // «кто победил» для журнала

// ================= Враги, которых видят и бьют ловушки и башни =================

function defHostiles(vision) {
  const out = [];
  for (const s of Game.skels || []) if ((s.state === 'roam' || s.state === 'fight' || s.state === 'rise') && s.k > 0.5) out.push({ kind: 'skel', o: s, x: s.x, y: s.y });
  if (typeof foeLive === 'function') for (const N of Game.raiders || []) if (foeLive(N) && N.st !== 'emerge') out.push({ kind: 'raid', o: N, x: N.x, y: N.y, fly: !!(FSPEC[N.k] && FSPEC[N.k].fly) });
  for (const a of Game.animals || []) if ((a.kind === 'wolf' || a.kind === 'fox') && !a.owner && !a.tamedBy && !a.dead) out.push({ kind: 'beast', o: a, x: a.x, y: a.y });
  if (vision) {
    for (const g of Game.ghosts || []) if (typeof g.x === 'number' && (g.alpha === undefined || g.alpha > 0.2)) out.push({ kind: 'ghost', o: g, x: g.x, y: g.y });
    if (typeof ENT_HIT !== 'undefined') for (const e of Game.ents || []) if (ENT_HIT.has(e.state)) out.push({ kind: 'ent', o: e, x: e.x, y: e.y });
  }
  return out;
}

function defKill(h, label) {
  const o = h.o;
  if (h.kind === 'skel') {
    o.state = 'dead'; o.t = 0; o.moving = false; o.resolved = true;
    sfxAt('rattle', o.x * TILE, o.y * TILE, 1.2);
    fxBurst(o.x * TILE, o.y * TILE - 10, 22, ['#e6dfc8', '#c8c0a4', '#8a6a3a'], 80, 50, 1.1, 2.2, 260);
    floater(o.x, o.y - 1.6, 'Клац…', '#e8e8d0');
    logEvent('tree', `${label} сразил скелета`, o.x, o.y);
  } else if (h.kind === 'beast') {
    removeAnimal(o);
    dropPile(Math.floor(o.x), Math.floor(o.y), 'hide', o.kind === 'wolf' ? 2 : 1);
    fxBurst(o.x * TILE, o.y * TILE - 6, 10, ['#8a6a4a', '#c8a880'], 50, 40, 0.8, 1.6, 200);
    logEvent('tree', `${label} прогнал ${o.kind === 'wolf' ? 'волка' : 'лису'}`, o.x, o.y);
  }
}

// Урон по врагу: p — шанс попасть, dmg — урон по «живым» врагам с запасом здоровья. Возвращает true, если попал
function defHurt(h, p, dmg, from, label) {
  if (Math.random() > p) {
    if (h.kind !== 'ghost') fxBurst(h.x * TILE, h.y * TILE - 8, 4, ['#f6f2ea', '#c8c0a4'], 35, 25, 0.35, 1.1, 200);
    return false;
  }
  DEF_KILLER.x = from[0]; DEF_KILLER.y = from[1];
  if (h.kind === 'skel' || h.kind === 'beast') { defKill(h, label); return true; }
  if (h.kind === 'raid') { foeHit(h.o, DEF_KILLER, dmg); return true; }
  if (h.kind === 'ent') {                                   // ожившее дерево или камень: берёт хуже скелета
    if (typeof ENT_HIT === 'undefined' || !ENT_HIT.has(h.o.state) || Math.random() > (h.o.rock ? 0.35 : 0.5)) return false;
    entFell(h.o, DEF_KILLER); return true;
  }
  return false;
}

// ================= Стрела =================

function defShot(from, h, kind, delay, onLand) {
  const dur = Math.max(0.2, Math.min(0.6, Math.hypot(h.x - from[0], h.y - from[1]) * 0.07));
  Game.dshots.push({ x: from[0], y: from[1], gx: h.x, gy: h.y - 0.5, born: Game.time + delay, dur, k: kind });
  DEF.pend.push({ at: Game.time + delay + dur, fn: onLand });
}

// ================= Ловушки =================

function defTrapTrigger(i, o, h) {
  const x = i % MAP_W, y = (i / MAP_W) | 0, px = x * TILE + 16, py = y * TILE + 16;
  const L = o.lv - 1;
  const from = [x + 0.5, y + 0.5];
  if (o.f === 'pit') {
    fxBurst(px, py, 14, ['#6a4a2a', '#8a6a44', '#4a3a24'], 55, 40, 0.8, 2, 240);
    sfxAt('thud', px, py, 0.9);
    if (h.kind === 'raid') { foeHit(h.o, (DEF_KILLER.x = from[0], DEF_KILLER.y = from[1], DEF_KILLER), 12 + L * 8); h.o.stunT = Game.time + 2.4; }
    else { if (!defHurt(h, 0.7 + L * 0.2, 0, from, 'Волчья яма')) h.o.scared = Math.max(h.o.scared || 0, 2.2); }
    floater(x + 0.5, y - 0.3, 'Яма!', '#e8c890');
  } else if (o.f === 'spike') {
    fxBurst(px, py, 10, ['#b8b8c4', '#8a8a96', '#e0e0e8'], 55, 35, 0.6, 1.6, 240);
    sfxAt('hiss', px, py, 0.8);
    if (h.kind === 'raid') { foeHit(h.o, (DEF_KILLER.x = from[0], DEF_KILLER.y = from[1], DEF_KILLER), 8 + L * 6); h.o.stunT = Game.time + 0.5; }
    else defHurt(h, 0.5 + L * 0.25, 0, from, 'Шипы');
    floater(x + 0.5, y - 0.3, 'Шипы!', '#d0d0e0');
  } else if (o.f === 'fire') {
    fxBurst(px, py - 6, 26, ['#ffd060', '#ff8a30', '#ff5a20', '#fff0a0'], 70, 70, 0.9, 2.2, 90);
    sfxAt('crackle', px, py, 1);
    o.flash = Math.round(Game.time * 10) / 10;
    if (h.kind === 'raid') {
      foeHit(h.o, (DEF_KILLER.x = from[0], DEF_KILLER.y = from[1], DEF_KILLER), 14 + L * 8);
      DEF.dots.push({ o: h.o, left: 3, at: Game.time + 0.5, dmg: 4 + L * 3 });
    } else if (!defHurt(h, 0.8 + L * 0.15, 0, from, 'Огненная ловушка')) h.o.scared = Math.max(h.o.scared || 0, 3);
    floater(x + 0.5, y - 0.5, 'Огонь!', '#ffb050');
  }
  o.hp--;
  if (o.hp <= 0) { World.obj[i] = null; DEF.set.delete(i); DEF.prog.delete(i); logEvent('build', `${FORTS[o.f].name} сработала в последний раз`, x + 0.5, y); }
}
DEF.dots = [];

function defTrapsTick(hostiles) {
  if (!hostiles.length) return;
  for (const i of DEF.set) {
    const o = World.obj[i];
    if (!o || o.t !== 'fort' || !FORTS[o.f].trap || o.bt !== undefined) continue;
    const cx = i % MAP_W + 0.5, cy = ((i / MAP_W) | 0) + 0.5;
    for (const h of hostiles) {
      if (h.fly || h.kind === 'ghost' || h.kind === 'ent') continue;
      if (Math.abs(h.x - cx) > 0.62 || Math.abs(h.y - cy) > 0.62) continue;
      if (h.kind === 'raid' && h.o.st === 'die') continue;
      // одна и та же нечисть не топчет ловушку чаще раза в 1,2 с
      const last = DEF.bumpT.get(h.o) || -9;
      if (Game.time - last < 1.2) continue;
      DEF.bumpT.set(h.o, Game.time);
      defTrapTrigger(i, o, h);
      break;
    }
  }
}

// ================= Башни =================

function defTowerState(b) {
  let T = DEF.towers.get(b.id);
  if (!T) {
    T = { b: b.id, g: [], al: -99, act: -99, cd: [0, 0, 0, 0], gT: 0 };
    DEF.towers.set(b.id, T);
    Game.dtowers.push(T);
  }
  return T;
}

const defPost = b => {
  const gz = TOWER_GZ[(b.level || 1) >= 2 ? 1 : 0];
  return [b.x + (32 + 4.5) / TILE + 0.0, b.y + (64 - 0.78 * 9 - gz) / TILE];
};

function defShooters(b, T) {
  const L = (b.level || 1) >= 2;
  const out = [{ who: 'Дозорный', range: L ? 9.5 : 8.5, acc: L ? 0.55 : 0.45, cd: L ? 1.8 : 2.4, dmg: L ? 8 : 6, kind: 'arrow' }];
  for (const g of T.g) {
    if (g.c === 'archer') out.push({ who: 'Лучник башни', range: 8.5 + (L ? 1 : 0), acc: Math.min(0.9, 0.5 + 0.05 * g.l), cd: 1.6, dmg: 7 + g.l, kind: 'arrow' });
    else out.push({ who: 'Воин башни', range: 5.5, acc: Math.min(0.9, 0.45 + 0.045 * g.l), cd: 2.0, dmg: 9 + g.l, kind: 'spear' });
  }
  return out;
}

function defGarrison(b, T) {
  const L = (b.level || 1) >= 2 ? 1 : 0, cap = TOWER_CAP[L];
  const gs = [];
  for (const u of Game.units) {
    if (!u.rec || u.rec.post !== b.id || u.dead) continue;
    if (u.rec.order !== 'post') { u.rec.post = 0; continue; }
    gs.push(u);
  }
  if (!b.noGuards && gs.length < cap) {
    let best = null, bd = 1e9;
    for (const u of Game.units) {
      const R = u.rec;
      if (!R || R.post || u.dead || u.brk || !(R.cls === 'archer' || R.cls === 'warrior') || R.order !== 'guard' || R.train > 0 || u.inside) continue;
      const d = Math.hypot(u.x - b.doorX, u.y - b.doorY);
      if (d < bd && d < 40) { bd = d; best = u; }
    }
    if (best) {
      setOrder(best, 'post');
      best.rec.post = b.id;
      gs.push(best);
      floater(best.x, best.y - 1.8, 'На башню!', '#f6d458');
    }
  }
  T.g = gs.filter(u => u.inside === b).map(u => ({ c: u.rec.cls, l: u.rec.lvl }));
  T.n = gs.length;
}

function defTowerTick(b, step, hostiles, vis) {
  const T = defTowerState(b), L = (b.level || 1) >= 2 ? 1 : 0;
  T.gT -= step;
  if (T.gT <= 0) { T.gT = 1; defGarrison(b, T); }
  const post = defPost(b);
  // замечает заранее: радиус обзора больше дальности выстрела
  const see = L ? 14 : 11;
  let fresh = null, fn = 0;
  for (const h of vis) {
    const d = Math.hypot(h.x - post[0], h.y - post[1]);
    if (d > see) continue;
    if (h.kind === 'raid' && h.o.st === 'die') continue;
    const s = DEF.seen.get(h.o);
    if (s === undefined) { DEF.seen.set(h.o, Game.time); fn++; if (!fresh || d < fresh.d) fresh = { h, d }; }
  }
  if (fresh && Game.time - DEF.alertT > 18) {
    DEF.alertT = Game.time; T.al = Game.time;
    const dx = fresh.h.x - post[0], dy = fresh.h.y - post[1];
    const side = Math.abs(dx) > Math.abs(dy) * 1.4 ? (dx > 0 ? 'востока' : 'запада') : Math.abs(dy) > Math.abs(dx) * 1.4 ? (dy > 0 ? 'юга' : 'севера') : (dy > 0 ? (dx > 0 ? 'юго-востока' : 'юго-запада') : (dx > 0 ? 'северо-востока' : 'северо-запада'));
    const what = fresh.h.kind === 'raid' ? 'враги Малгора' : fresh.h.kind === 'ghost' ? 'призраки' : fresh.h.kind === 'skel' ? 'скелеты' : fresh.h.kind === 'ent' ? 'ожившие деревья' : 'звери';
    floater(post[0], post[1] - 1, 'Нечисть!', '#ffb060');
    logEvent('night', `Дозорный башни видит: ${what} с ${side}${fn > 1 ? ` (${fn})` : ''}`, post[0], post[1]);
    sfxAt('chime', post[0] * TILE, post[1] * TILE, 0.8);
  }
  // стрельба: у каждого стрелка своя перезарядка
  const sh = defShooters(b, T);
  const targets = hostiles.filter(h => h.kind !== 'ghost' && !(h.kind === 'raid' && h.o.st === 'die'));
  for (let k = 0; k < sh.length; k++) {
    T.cd[k] = (T.cd[k] || 0) - step;
    if (T.cd[k] > 0) continue;
    const s = sh[k];
    let best = null, bd = s.range;
    for (const h of targets) {
      const d = Math.hypot(h.x - post[0], h.y - post[1]);
      if (d < bd) { bd = d; best = h; }
    }
    if (!best) { T.cd[k] = 0.3; continue; }
    T.cd[k] = s.cd * (0.9 + Math.random() * 0.25);
    T.act = Game.time;
    const h = best;
    defShot(post, h, s.kind, k * 0.05, () => {
      if (h.kind === 'raid' && !(typeof foeLive === 'function' && foeLive(h.o))) return;
      defHurt(h, s.acc, s.dmg, post, s.who);
    });
    sfxAt('hiss', post[0] * TILE, post[1] * TILE, 0.25);
  }
}

// ================= Факелы =================

function defTorchTick(hostiles) {
  if (!fortNight() && !hostiles.length) return;
  for (const i of DEF.set) {
    const o = World.obj[i];
    if (!o || o.f !== 'torch' || o.bt !== undefined) continue;
    const cx = i % MAP_W + 0.5, cy = ((i / MAP_W) | 0) + 0.5, r = o.lv >= 2 ? 2.6 : 1.8;
    for (const h of hostiles) if (h.kind === 'skel' && Math.hypot(h.x - cx, h.y - cy) < r) h.o.scared = Math.max(h.o.scared || 0, 1.5);
  }
}

// ================= Такт =================

function defenseTick(dt) {
  if (isDefMirror()) return;
  // снаряды: урон в момент попадания
  for (let k = DEF.pend.length - 1; k >= 0; k--) if (Game.time >= DEF.pend[k].at) { const p = DEF.pend.splice(k, 1)[0]; try { p.fn(); } catch (e) { console.warn(e); } }
  for (let k = Game.dshots.length - 1; k >= 0; k--) if (Game.time > Game.dshots[k].born + Game.dshots[k].dur + 0.15) Game.dshots.splice(k, 1);
  for (let k = DEF.dots.length - 1; k >= 0; k--) {
    const d = DEF.dots[k];
    if (Game.time < d.at) continue;
    if (!(typeof foeLive === 'function' && foeLive(d.o)) || --d.left < 0) { DEF.dots.splice(k, 1); continue; }
    d.at = Game.time + 0.5;
    foeHit(d.o, DEF_KILLER, d.dmg);
    fxBurst(d.o.x * TILE, d.o.y * TILE - 8, 5, ['#ffb040', '#ff7020'], 30, 40, 0.4, 1.4, 60);
  }
  DEF.t += dt;
  if (DEF.t < 0.25) return;
  const step = DEF.t; DEF.t = 0;
  DEF.scanT += step;
  if (DEF.scanT > 15) { DEF.scanT = 0; defRescan(); }

  // стройка и достройка
  for (const i of DEF.set) {
    const o = World.obj[i];
    if (!o || o.t !== 'fort') { DEF.set.delete(i); DEF.prog.delete(i); continue; }
    const F = FORTS[o.f];
    if (o.bt !== undefined) {
      const p = (DEF.prog.get(i) || 0) + step;
      DEF.prog.set(i, p);
      const q = Math.min(1, p / F.time[0]);
      if (q >= 1) {
        // не замуровывать жителя: пока кто-то стоит на клетке, стройка ждёт
        let busy = false;
        if (F.blk) for (const u of Game.units) if (!u.dead && !u.inside && Math.floor(u.x) === i % MAP_W && Math.floor(u.y) === ((i / MAP_W) | 0)) { busy = true; break; }
        if (busy) { DEF.prog.set(i, F.time[0] * 0.98); o.bt = 0.98; continue; }
        defFinish(i);
      } else if (Math.abs(q - o.bt) >= 0.07) o.bt = Math.round(q * 20) / 20;
    } else if (o.up !== undefined) {
      const p = (DEF.prog.get(i) || 0) + step;
      DEF.prog.set(i, p);
      const q = Math.min(1, p / F.time[1]);
      if (q >= 1) {
        delete o.up; o.lv = 2; o.hp = fortMax(o); DEF.prog.delete(i);
        const x = i % MAP_W, y = (i / MAP_W) | 0;
        fxBurst(x * TILE + 16, y * TILE + 10, 14, ['#ffe08a', '#d8b070', '#cfc7b4'], 60, 50, 0.8, 2, 200);
        floater(x + 0.5, y - 0.6, 'Уровень 2!', '#ffe08a');
        sfxAt('build', x * TILE, y * TILE, 0.6);
      } else if (Math.abs(q - o.up) >= 0.07) o.up = Math.round(q * 20) / 20;
    }
  }

  // ворота: автоматически закрыты вечером и ночью
  DEF.gateT = (DEF.gateT || 0) + step;
  if (DEF.gateT >= 0.5) {
    DEF.gateT = 0;
    for (const i of defGatesSync()) sfxAt('creak', (i % MAP_W) * TILE, ((i / MAP_W) | 0) * TILE, 0.5);
  }

  // днём стены понемногу подновляют сами (кто-то же должен): +1 прочность за 8 с, пока не бьют
  DEF.regenT += step;
  if (DEF.regenT >= 8) {
    DEF.regenT = 0;
    if (!fortNight()) for (const i of DEF.set) {
      const o = World.obj[i];
      if (!o || o.bt !== undefined || !FORTS[o.f].hp || o.hp >= fortMax(o) || Game.time - (o.hurt || -99) < 20) continue;
      o.hp = Math.min(fortMax(o), o.hp + 2);
    }
  }

  // враги, ловушки, башни, факелы
  const hasTower = Game.buildings.some(b => b.type === 'watchtower' && b.state === 'done');
  const hostiles = defHostiles(false);
  defTrapsTick(hostiles);
  defTorchTick(hostiles);
  if (hasTower) {
    const vis = defHostiles(true);
    for (const b of Game.buildings) if (b.type === 'watchtower' && b.state === 'done' && !b.removed) defTowerTick(b, step, hostiles, vis);
  }
  // убранные башни
  for (let k = Game.dtowers.length - 1; k >= 0; k--) {
    const T = Game.dtowers[k];
    if (!Game.buildings.some(b => b.id === T.b && !b.removed)) { Game.dtowers.splice(k, 1); DEF.towers.delete(T.b); }
  }
}

// ================= Нечисть у преград =================

// Налётчик: врезаться в стену нельзя, закрытые ворота — тоже
if (typeof rdOk === 'function') {
  const _rdOk = rdOk;
  rdOk = function (N, x, y) {
    if (!_rdOk(N, x, y)) return false;
    if (FSPEC[N.k] && FSPEC[N.k].fly) return true;
    return !defFoeBlocked(x, y);
  };
  const _rdStep = rdStep;
  rdStep = function (N, tx, ty, spd, dt) {
    if (N.stunT > Game.time) return false;                 // ловушка: стоит, хватается за ногу
    const ox = N.x, oy = N.y;
    const r = _rdStep(N, tx, ty, spd, dt);
    if (FSPEC[N.k] && FSPEC[N.k].fly) return r;
    if (Math.abs(N.x - ox) + Math.abs(N.y - oy) < 0.0005) defBump(N, tx, ty, dt);
    return r;
  };
}

// Упёрся в стену, баррикаду или закрытые ворота — ломает
function defBump(N, tx, ty, dt) {
  const dx = tx - N.x, dy = ty - N.y, d = Math.hypot(dx, dy);
  if (d < 0.3) return;
  const ux = dx / d, uy = dy / d;
  let o = null, ci = -1;
  for (const k of [0.62, 0.95]) {
    const x = Math.floor(N.x + ux * k), y = Math.floor(N.y + uy * k);
    const f = fortAt(x, y);
    if (f && fortDone(f) && (f.blk || (f.f === 'gate' && !f.open))) { o = f; ci = idx(x, y); break; }
  }
  if (!o) return;
  const dps = N.k === 'malgor' ? 40 : N.k === 'knight' ? 9 : 5;
  o.hp -= dps * dt * (N.lv || 1);
  o.hurt = Math.round(Game.time);
  N.st = N.st === 'atk' ? N.st : 'chase';
  N.bt = (N.bt || 0) + dt;
  if (N.bt > 0.8) {
    N.bt = 0;
    const x = ci % MAP_W, y = (ci / MAP_W) | 0;
    fxBurst(x * TILE + 16, y * TILE + 12, 6, ['#8a6a44', '#cfc7b4', '#4a3e88'], 40, 30, 0.5, 1.6, 200);
    sfxAt('thud', x * TILE, y * TILE, 0.7);
  }
  o.hp = Math.round(o.hp * 10) / 10;
  if (o.hp <= 0) {
    const x = ci % MAP_W, y = (ci / MAP_W) | 0, nm = FORTS[o.f].name;
    World.obj[ci] = null; DEF.set.delete(ci); DEF.prog.delete(ci);
    PF.regT = -1e9;
    fxBurst(x * TILE + 16, y * TILE + 14, 22, ['#8a6a44', '#cfc7b4', '#5a4a38', '#4a3e88'], 80, 60, 1, 2.4, 260);
    sfxAt('thud', x * TILE, y * TILE, 1.2);
    logEvent('night', `Нечисть пробила: ${nm.toLowerCase()}`, x + 0.5, y);
    toast(`Нечисть пробила: ${nm.toLowerCase()}!`);
    N.pk = '';                                       // путь пересчитать: преграды больше нет
  }
}

// Скелеты не проходят сквозь стены и закрытые ворота (призраки — проходят)
if (typeof skelMove === 'function') {
  const _skelMove = skelMove;
  skelMove = function (s, tx, ty, speed, dt) {
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    if (d > 0.05) {
      const nx = s.x + dx / d * Math.min(d, speed * dt + 0.35), ny = s.y + dy / d * Math.min(d, speed * dt + 0.35);
      if (defFoeBlocked(nx, ny)) { s.moving = false; s.goal = null; s.wait = 0.8; return true; }
    }
    return _skelMove(s, tx, ty, speed, dt);
  };
}

// Дикие звери (волки, лисы, олени…) не проходят закрытые ворота; ручные и пастушьи — как жители
if (typeof animalStep === 'function') {
  const _animalStep = animalStep;
  animalStep = function (a, dt, speed) {
    if (a.path && !a.owner && !a.follow && !a.tamedBy) {
      const c = a.path[a.pi], o = c && fortAt(c[0], c[1]);
      if (o && o.f === 'gate' && !o.open && fortDone(o) && (Math.floor(a.x) !== c[0] || Math.floor(a.y) !== c[1])) {
        a.path = null; a.moving = false; a.wait = 1.5 + Math.random() * 2;   // стоит у ворот, путь переищет позже
        return true;
      }
    }
    return _animalStep(a, dt, speed);
  };
}

// ================= Страж на башне =================

function* defPostGen(u) {
  const R = u.rec;
  const b = Game.buildings.find(x => x.id === R.post && !x.removed && x.type === 'watchtower' && x.state === 'done');
  if (!b) { R.order = 'guard'; R.post = 0; return; }
  if (u.inside !== b) {
    const ok = yield { walk: [b.doorX, b.doorY] };
    if (!ok) { yield { wait: 3 }; return; }
    yield { enter: b };
  }
  while (R.order === 'post' && !b.removed && u.inside === b && !u.wantsEat() && !b.noGuards) yield { wait: 1 };
  if (u.inside === b) yield { leave: true };
  if (b.noGuards || b.removed) { R.order = 'guard'; R.post = 0; }
}

function defEject(u) {
  const b = u.inside;
  if (b && b.type === 'watchtower') { u.inside = null; u.x = b.doorX + 0.5; u.y = b.doorY + 0.5; u.proc = null; u.action = null; u.anim = null; }
}

if (typeof setOrder === 'function') {
  const _so = setOrder;
  setOrder = function (u, order, pt, leader) {
    if (u.rec && u.rec.post && order !== 'post') { u.rec.post = 0; defEject(u); }
    return _so(u, order, pt, leader);
  };
  if (typeof dismissRecruit === 'function') {
    const _dr = dismissRecruit;
    dismissRecruit = function (u) { if (u.rec) u.rec.post = 0; defEject(u); return _dr(u); };
  }
}

// ================= Подключение к ходу игры =================

{
  const _step = step;
  step = function (dt) { _step(dt); defenseTick(dt); };
}

// ================= Кооператив (сервер) =================

function defCoopCmd(name, m, admin) {
  const can = k => { if (admin || coop.perms[k]) return true; coopSay(name, 'Хост запретил: ' + COOP_PERMS[k].toLowerCase()); return false; };
  const cell = c => Array.isArray(c) && Number.isInteger(c[0]) && Number.isInteger(c[1]) && inb(c[0], c[1]);
  switch (m.a) {
    case 'place': {
      if (!can('build') || !FORTS[m.f] || !Array.isArray(m.cells)) break;
      if (!admin && !isUnlocked('fort:' + m.f)) { coopSay(name, 'Это ещё не открыто для деревни'); break; }
      const cells = m.cells.filter(cell).slice(0, 80);
      if (!cells.length) break;
      const r = defPlaceMany(m.f, cells);
      if (r.err && !r.n) coopSay(name, r.err);
      else if (r.err) coopSay(name, `Поставлено: ${r.n}. ${r.err}`);
      break;
    }
    case 'upg': if (can('upgrade') && cell([m.x, m.y])) { const e = defUpgrade(m.x, m.y); if (e) coopSay(name, e); } break;
    case 'repair': if (can('build') && cell([m.x, m.y])) { const e = defRepair(m.x, m.y); if (e) coopSay(name, e); } break;
    case 'gate': if (can('manage') && cell([m.x, m.y]) && ['auto', 'open', 'closed'].includes(m.mode)) defGateMode(m.x, m.y, m.mode); break;
    case 'erase': if (can('erase') && cell([m.x, m.y])) defErase(m.x, m.y); break;
    case 'ring': {
      if (!can('build')) break;
      const b = Game.buildings.find(x => x.id === m.id);
      const e = defRingBonfire(b);
      if (e) coopSay(name, e);
      break;
    }
    case 'guards': {
      if (!can('manage')) break;
      const b = Game.buildings.find(x => x.id === m.id && x.type === 'watchtower');
      if (b) b.noGuards = !b.noGuards;
      break;
    }
  }
}

function defServerSync() {
  if (DEF.hooked || !isDefServer()) return;
  DEF.hooked = true;
  const _cc = coopCmd;
  coopCmd = function (name, json, admin) {
    let m = null;
    try { m = JSON.parse(json); } catch (e) { return; }
    if (m && m.t === 'def') { defCoopCmd(name, m, admin); return; }
    return _cc(name, json, admin);
  };
  const _cm = coopMirror;
  coopMirror = function () {
    const m = _cm();
    m.dshots = coopList(Game.dshots);
    m.dtowers = coopList(Game.dtowers);
    return m;
  };
}
{
  const _dt = defenseTick;
  defenseTick = function (dt) { if (!DEF.hooked && isDefServer()) defServerSync(); return _dt(dt); };
}
