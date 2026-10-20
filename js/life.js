'use strict';
// «Живые» жители: перекуры, пьяный сон, столкновения с травмами.
// Всё это нарочно ломает ровный поток конвейера и требует внимания игрока.

// ---------- Перерывы ----------
// Перерыв подменяет текущее поведение, а потом возвращает его как было.

function startBreak(u, kind, gen) {
  if (kind === 'knock' || kind === 'faint' || kind === 'sleep') lanternFall(u);   // упал — фонарь вдребезги
  // перерыв поверх перерыва (испуг во время перекура, куры клюют спящего…): возвращаться надо к делу,
  // а не к прерванному перекуру — иначе доставка терялась, а её бронь на складе висела навсегда
  if (u.brk) {
    const prev = u.brk;
    if (u.blockT >= 0 && World.occ[u.blockT] === u.id) World.occ[u.blockT] = 0;
    u.blockT = -1;
    if (prev.kind === 'smoke' || prev.kind === 'join') Game.smokers.delete(u);
    u.brk = null;
    if (prev.saved) { u.proc = prev.saved.proc; u.action = prev.saved.action; }
  }
  const saved = { proc: u.proc, action: u.action };
  if (saved.action && saved.action.walk) { saved.action.path = null; saved.action.i = 0; saved.action.block = 0; saved.action.squeeze = false; }
  u.brk = { kind, saved, until: 0 };
  u.proc = gen;
  u.action = null; u.anim = null; u.lastRes = undefined;
  // стоящий на дороге занимает клетку — другим придётся протискиваться
  if (u.isCourier) u.releaseOcc();
  const i = idx(Math.floor(u.x), Math.floor(u.y));
  if (World.road[i] && !World.occ[i]) { World.occ[i] = u.id; u.blockT = i; }
}

function endBreak(u) {
  const s = u.brk.saved;
  dropBreak(u);
  u.proc = s.proc; u.action = s.action; u.anim = null; u.lastRes = undefined;
  // в перерыве уронил ношу (бежал от нечисти, сбили с ног) — нести нечего: не идём пустыми через
  // всю деревню, а берём новое дело. Учёт «в пути» поправит auditIncoming
  const d = u.dlv;
  if (d && d.picked && !u.carry && s.proc && d.gen === s.proc && u.isCourier) { u.dlv = null; u.proc = null; u.action = null; }
}

// Перерыв отменяется насовсем (гному дали приказ, он погиб или возродился): прерванное дело не возвращаем,
// но клетку перекура освобождаем и из курящих вычёркиваем — иначе она занята, пока он снова на неё не наступит
function dropBreak(u) {
  if (u.blockT >= 0 && World.occ[u.blockT] === u.id) World.occ[u.blockT] = 0;
  u.blockT = -1;
  Game.smokers.delete(u);
  u.brk = null;
}

function* smokeGen(u, time) {
  u.brk.until = Game.time + time;
  Game.smokers.add(u);
  yield { wait: time, anim: 'smoke' };
  if (Math.random() < 0.25) litter(u);                // окурок под ноги
}

const FOOD_WORKERS = new Set(['farmer', 'miller', 'baker', 'butcher', 'breeder']);

function* joinGen(u, host) {
  // подойти к курящему и встать рядом
  const hx = Math.floor(host.x), hy = Math.floor(host.y);
  const spot = randomFreeNear(hx, hy, 1, 1.5, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)]);
  if (spot) yield { walk: spot, offroad: true };
  if (!host.brk || (host.brk.kind !== 'smoke' && host.brk.kind !== 'join')) return;
  u.face = host.x > u.x ? 1 : -1;
  u.vdir = 'E';
  const i = idx(Math.floor(u.x), Math.floor(u.y));
  if (World.road[i] && !World.occ[i]) { World.occ[i] = u.id; u.blockT = i; }
  yield* smokeGen(u, JOIN_SMOKE_TIME);
}

// Отлёт при столкновении: гнома отбрасывает назад по дуге, он падает на спину,
// полежит со звёздочками перед глазами и встаёт продолжать своё дело.
function knockBack(u, from) {
  if (!isPerson(u) || u.type === 'carter' || u.inside) return;
  if (u.brk && u.brk.kind === 'knock') return;
  if (!interruptible(u) && !(u.action && u.action.walk)) return;
  if (u.brk) endBreak(u);
  let dx = u.x - from.x, dy = u.y - from.y, d = Math.hypot(dx, dy);
  if (d < 0.05) { dx = u.face ? -u.face : 1; dy = 0; d = 1; }
  dx /= d; dy /= d;
  // куда приземлится: до 1.2 клетки назад, если там можно стоять
  let L = 1.2;
  while (L > 0.2 && !isWalkable(Math.floor(u.x + dx * L), Math.floor(u.y + dy * L))) L -= 0.3;
  startBreak(u, 'knock', null);
  u.proc = knockGen(u, dx * L, dy * L);
}

function* knockGen(u, dx, dy) {
  u.knock = { x0: u.x, y0: u.y, dx, dy };
  u.face = dx > 0 ? -1 : 1;                 // лицом к тому, в кого врезался
  u.ouchUntil = Game.time + 2.2;
  yield { wait: 0.42, anim: 'fly' };
  u.x = u.knock.x0 + dx; u.y = u.knock.y0 + dy;
  yield { wait: 1.5, anim: 'knocked' };      // лежит, приходит в себя
  u.knock = null;
}

let lastFaintToast = -99;
function* faintGen(u) {
  u.brk.until = Game.time + FAINT_TIME;
  yield { wait: FAINT_TIME, anim: 'faint' };
}

function* sleepGen(u) {
  u.brk.until = Game.time + SLEEP_TIME;
  yield { wait: SLEEP_TIME, anim: 'sleep' };
}

function isPerson(u) { return !UNIT_TYPES[u.type].animal; }

// Можно ли сейчас прервать жителя: он снаружи и просто идёт или ждёт без работы.
function interruptible(u) {
  if (u.brk || u.glide || u.inside || !isPerson(u)) return false;
  const a = u.action;
  if (!a) return true;
  if (a.walk) return true;
  if (a.wait !== undefined && !a.anim) return true;
  return false;
}

function lifeTick(u, dt) {
  if (u.fiveSlide) {      // «дай пять»: гномы сходятся вплотную, чтобы ладони встретились
    const f = u.fiveSlide, k = Math.min(1, (Game.time - f.t0) / 0.3), e = k * k * (3 - 2 * k);
    u.x = f.x0 + (f.x1 - f.x0) * e; u.y = f.y0 + (f.y1 - f.y0) * e;
    if (k >= 1) u.fiveSlide = null;
  }
  if (u.injury && Game.time >= u.injuryUntil) { u.injury = null; }
  // долго без еды — копит слабость
  if (u.food <= 0 && !u.noFood && !u.inside && isPerson(u) && !dif().noStarve) u.starveT = (u.starveT || 0) + dt * dif().starve;
  else if (u.food > 0) u.starveT = 0;
  u.lifeT = (u.lifeT || 0) + dt;
  if (u.lifeT < 0.5) return;
  u.lifeT = 0;
  socialTick(u);
  if (!interruptible(u)) return;
  // совсем оголодал — падает без сил и лежит, потом встаёт и плетётся дальше
  if (u.starveT > STARVE_FAINT) {
    u.starveT = -STARVE_FAINT;                      // следующий обморок нескоро
    if (u.carry) dropLoad(u);
    startBreak(u, 'faint', null);
    u.proc = faintGen(u);
    logEvent('food', `${UNIT_TYPES[u.type].name} упал от голода`, u.x, u.y);
    if (Game.time - lastFaintToast > 20) { lastFaintToast = Game.time; toast(`${UNIT_TYPES[u.type].name} упал от голода! Нужна еда в трактире`); }
    return;
  }
  // пьяный засыпает где стоит
  if (u.drunkAt && Game.time >= u.drunkAt) {
    u.drunkAt = 0;
    startBreak(u, 'sleep', null);
    u.proc = sleepGen(u);
    logEvent('people', `${UNIT_TYPES[u.type].name} перебрал пива и уснул`, u.x, u.y);
    if (Math.random() < 0.3) toast(`${UNIT_TYPES[u.type].name} перебрал пива и уснул на дороге`);
    return;
  }
  if (u.type === 'carter') return;
  // голодный идёт есть, а не курить; трудяга с заказом — сначала донесёт
  if (u.food < HUNGRY || u.carry || u.dlv) return;
  // заразно: подсесть к курящим может кто угодно, даже некурящий; начать сам — только курильщик
  // подсесть к курящим рядом
  // потолок эпидемии: когда курит больше трети деревни, новые не подсаживаются
  const smokeRoom = Game.smokers.size < Game.units.length * 0.33;
  // кто кормит деревню — к чужим перекурам не подсаживается
  const feeder = FOOD_WORKERS.has(u.type);
  if (smokeRoom && !feeder && Game.time >= u.nextJoin && Game.smokers.size) {
    let host = null, bd = JOIN_RADIUS;
    for (const s of Game.smokers) {
      if (s === u || !s.brk || s.brk.until - Game.time < JOIN_SMOKE_TIME * 0.6) continue;
      const d = Math.hypot(s.x - u.x, s.y - u.y);
      if (d < bd) { bd = d; host = s; }
    }
    if (host && Math.random() < 0.85) {          // увидел курящего — почти наверняка закурит сам
      u.nextJoin = Game.time + JOIN_CD;
      u.nextSmoke = Math.max(u.nextSmoke, Game.time + SMOKE_CD_MIN);
      startBreak(u, 'join', null);
      u.proc = joinGen(u, host);
      return;
    }
  }
  // сам решил покурить
  if (smokeRoom && u.smoker && Game.time >= u.nextSmoke && Math.random() < 0.25) {
    u.nextSmoke = Game.time + SMOKE_CD_MIN + Math.random() * (SMOKE_CD_MAX - SMOKE_CD_MIN);
    startBreak(u, 'smoke', null);
    u.proc = smokeGen(u, SMOKE_TIME);
  }
}

// ---------- Жесты: окружение ----------
// Гномы машут встречным, грозят кулаком волкам, показывают на оленя и зайца.
// Чисто внешнее: работу не прерывает, рисуется поверх походки.

function gesture(u, kind, time, tx) {
  u.gest = kind; u.gestUntil = Game.time + time;
  u.gestFace = tx > u.x ? 1 : -1;
  u.nextSocial = Game.time + 12 + Math.random() * 18;
  if (kind === 'wave') sfxUnit(u, 'hey'); else if (kind === 'fist') sfxUnit(u, 'grr');
}

function socialTick(u) {
  if (u.inside || u.brk || !isPerson(u) || u.type === 'carter') return;
  if ((u.nextSocial || 0) > Game.time) return;
  const a = u.action;
  if (a && a.anim) return;                       // занят делом
  for (const an of Game.animals) {
    if (an.dead) continue;
    const d = Math.hypot(an.x - u.x, an.y - u.y);
    if (an.kind === 'wolf' && d < 4.5) { gesture(u, u.carry ? 'scratch' : 'fist', 2.2, an.x); return; }
    if (an.kind !== 'wolf' && d < 3 && !u.carry && Math.random() < 0.15) { gesture(u, 'point', 1.8, an.x); return; }
  }
  // нечисть: призрак — пугаются, скелет — грозят кулаком (а то и пускаются наутёк)
  for (const g of Game.ghosts || []) {
    if (g.exo || g.alpha < 0.3 || g.mode === 'leave' || g.mode === 'calm' || Math.hypot(g.x - u.x, g.y - u.y) > 4) continue;
    gesture(u, 'panic', 1.6, g.x); return;
  }
  for (const s of Game.skels || []) {
    if (s.dead || Math.hypot(s.x - u.x, s.y - u.y) > 4.5) continue;
    gesture(u, Math.random() < 0.4 ? 'panic' : 'fist', 2, s.x); return;
  }
  if (Math.random() > 0.45) return;
  for (const o of Game.units) {
    if (o === u || o.inside || o.brk || !isPerson(o)) continue;
    const d = Math.hypot(o.x - u.x, o.y - u.y);
    if (d > 0.3 && d < 1.8) {
      const close = d < 0.85;            // «пять» — только вплотную друг к другу
      const free = !(o.action && o.action.anim) && !((o.fiveCD || 0) > Game.time);      // одна рука всё равно свободна
      // встреча: чаще дают пять (30%), реже машут (из остальных — только 20%, иначе проходят мимо)
      if (close && free && Math.random() < 0.3) { highFive(u, o); return; }
      if (Math.random() < 0.2) {
        gesture(u, 'wave', 1.5, o.x);
        if (!((o.nextSocial || 0) > Game.time) && !o.carry) gesture(o, 'wave', 1.5, u.x);   // машет в ответ
      } else u.nextSocial = Game.time + 6 + Math.random() * 8;
      return;
    }
  }
}

// «Дай пять!»: оба сходятся вплотную лицом к лицу (0.3 с), и 4 кадра: рука вскинута назад, замах, хлопок ладонями, опустили;
// после этого оба бодрее: скорость +15% на 2 секунды
const FIVE_T = 1.3, FIVE_GAP = 0.36;     // длительность и расстояние между гномами (в клетках) — ладони как раз встречаются
function fiveFrameAt(el) { return el < 0.3 ? 0 : el < 0.55 ? 1 : el < 0.95 ? 2 : 3; }
function highFive(a, b) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, s = b.x >= a.x ? 1 : -1;
  for (const [x, y, sg] of [[a, b, -s], [b, a, s]]) {
    gesture(x, 'five', FIVE_T, y.x);
    x.fiveSlide = { x0: x.x, y0: x.y, x1: mx + sg * FIVE_GAP / 2, y1: my, t0: Game.time };
    x.boostUntil = Game.time + FIVE_T + 2;
    x.pauseUntil = Game.time + FIVE_T;                         // замирают на время хлопка
    x.fiveCD = Game.time + 30 + Math.random() * 30;          // не чаще раза в 30–60 с
    x.nextSocial = Game.time + 8 + Math.random() * 10;
  }
  const hy = my - 0.62;                                        // ладони на уровне головы
  fxLater(0.55, () => {
    fxBurst(mx * TILE, hy * TILE, 8, ['#fff2a0', '#ffd860', '#ffffff'], 46, 36, 0.35, 1.4, 120);
    sfxAt('five', mx * TILE, hy * TILE);
    floater(mx, hy - 0.5, 'Дай пять!', '#fff2a0');
  });
}

// ---------- Столкновения и травмы ----------

const bumpCD = new Map();

function injure(u, part) {
  if (u.injury || !isPerson(u)) return;
  u.injury = part;
  u.injuryUntil = Game.time + INJURY_TIME;
}

function dropLoad(u) {
  if (!u.carry) return null;
  const g = u.carry, n = u.carryN || 1;
  dropPile(Math.floor(u.x), Math.floor(u.y), g, n);
  u.carry = null; u.carryN = 0;
  return g;
}

let lastBumpToast = -99;

function checkCollisions() {
  // клетка -> первый гном в ней, дальше цепочкой через _cn (без массивов на каждую клетку четыре раза в секунду)
  const grid = new Map();
  for (const u of Game.units) {
    if (u.inside) continue;
    const k = Math.floor(u.x) + Math.floor(u.y) * MAP_W;
    u._cn = grid.get(k) || null;
    grid.set(k, u);
  }
  for (const u of Game.units) {
    if (u.inside || !(u.action && u.action.walk && u.action.path) || u.hopUntil > Game.time || u.gp) continue;   // на классиках и за игрой не толкаются (games.js)
    const tx = Math.floor(u.x), ty = Math.floor(u.y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (let o = grid.get(tx + dx + (ty + dy) * MAP_W); o; o = o._cn) {
        // гнома могло уже отбросить столкновением — его действие сброшено, дальше не проверяем
        if (!u.action || !u.action.walk) break;
        if (o === u || o.id < u.id && o.action && o.action.walk) continue;   // пару считаем один раз
        if (o.hopUntil > Game.time || o.gp) continue;
        const ex = o.x - u.x, ey = o.y - u.y;
        if (ex * ex + ey * ey > 0.42 * 0.42) continue;
        const key = Math.min(u.id, o.id) * 100000 + Math.max(u.id, o.id);
        if ((bumpCD.get(key) || 0) > Game.time) continue;
        bumpCD.set(key, Game.time + 6);
        const carrier = u.carry ? u : o.carry ? o : null;
        if (!carrier) continue;
        const victim = carrier === u ? o : u;
        if (!isPerson(victim)) continue;
        let p = COLLIDE_CHANCE * (1 + 0.2 * rainAmt()) * (dif().amb || 1) * startBump();   // под дождём толкаются чаще
        if (u.action?.squeeze || o.action?.squeeze) p += 0.06;
        if (o.brk && o.brk.kind === 'sleep') p += 0.18;
        if (u.drunkAt || o.drunkAt) p += 0.06;
        if (HEAVY.has(carrier.carry)) p += 0.02;
        if (Math.random() > p) continue;
        const g = dropLoad(carrier);
        const part = Math.random() < 0.5 ? 'leg' : 'arm';
        injure(victim, part);
        victim.ouchUntil = Game.time + 2.5;                    // искры из глаз
        sfxUnit(victim, 'ouch');
        // оба отлетают назад друг от друга и падают
        knockBack(victim, carrier); knockBack(carrier, victim);
        logEvent('bump', `Столкновение: ${UNIT_TYPES[carrier.type].name.toLowerCase()} уронил «${GOODS[g].name}», ${UNIT_TYPES[victim.type].name.toLowerCase()} ${part === 'leg' ? 'хромает' : 'повредил руку'}`, victim.x, victim.y);
        if (Game.time - lastBumpToast > 8) {
          lastBumpToast = Game.time;
          toast(`Столкновение: ${UNIT_TYPES[carrier.type].name.toLowerCase()} уронил «${GOODS[g].name}», ${UNIT_TYPES[victim.type].name.toLowerCase()} ${part === 'leg' ? 'теперь хромает' : 'повредил руку'}`);
        }
      }
    }
  }
  if (bumpCD.size > 4000) for (const [k, t] of bumpCD) if (t < Game.time) bumpCD.delete(k);
}
