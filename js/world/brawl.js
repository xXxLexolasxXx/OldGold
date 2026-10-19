'use strict';
// Пьяная драка на празднике (festival.js). Двое-трое гуляк, хлебнувших не меньше трёх кружек, сходятся и дерутся:
// кулаки, пинок или бутыль (у каждого свой «стиль»), потом проигравший шатается, падает, лежит и встаёт, а победители ликуют.
// Раз в пару суток и только пока идёт праздник и нет нечисти. Если рядом герой и он свободен — его случайно цепляет
// и отбрасывает на две клетки (небольшой урон, оглушение, реплика), но не убивает и боя с нечистью не ломает.
//
// Кадры считает чистая функция времени (brawlPose): сервер задаёт u.brawl = {t0, me, n, att, tg, st, R, lose, lie, endI}
// и двигает героя, а клиенты коопа по тому же u.brawl сами рисуют те же кадры (поле идёт в COOP_UNIT_EX).
//
// Почему 12 кадров на пару: удар разбит на 6 шагов по 0.15 с — стойка, замах, замах (держит, чтобы удар читался), удар, отдача, стойка.
// Один круг драки = каждый ударил и каждый получил = 2 × 6 = 12 шагов (1.8 с); всего 2 круга (4 раунда) на пару, 3 круга на троих.
// Тот, кто получает: стойка, стойка, прикрылся/сжался, УДАР, шатание, (последним — второе шатание и падение). Меньше — удар не читается,
// больше — драка выглядит вязкой. Отлёт героя — 6 фаз: удар → взлёт → верхняя точка → падение → приземление-лёжа → сел и встаёт.

const BR_STEP = 0.15;                   // шаг кадра, с
const BR_ROUND = 6;                     // шагов в раунде (один бьёт, другой получает)
const BR_FALL = 3, BR_UP = 3;           // шагов на падение и вставание
const BR_WIN = 8;                       // шагов ликования победителей
const BR_DRINKS = 3;                    // сколько кружек надо выпить, чтобы лезть в драку
const BR_GAP = [CYCLE * 2, CYCLE * 2.8];   // пауза после драки: не чаще раза в пару суток
const BR_HELLO = 40;                    // не раньше чем через столько секунд после начала праздника
const BR_CHANCE = 0.004;                // шанс начать драку в секунду, когда есть кому
const BR_HERO_R = 2.5;                  // герой в такой близости от удара может попасть под раздачу
const BR_HERO_FLY = 2;                  // клеток отлёта
const BR_FLY_T = 3.4;                   // весь отлёт, с (полёт до 0.6, лежит до 2.2, сидит до 2.9, встаёт до 3.4)

const BR_ATT = {
  f: ['ready', 'windup', 'windup', 'strike', 'follow', 'ready'],
  k: ['ready', 'kwind', 'kwind', 'kick', 'kfollow', 'ready'],
  b: ['ready', 'bwind', 'bwind', 'bhit', 'bfollow', 'ready'],
};
const BR_HIT = new Set(['strike', 'kick', 'bhit']);
const BR_SHOUT = ['Ах ты бородач!', 'Получай!', 'А ну иди сюда!', 'Я тебя уважаю! Бам!', 'Кто пил мой эль?!', 'Моя кружка!'];
const BR_HERO_SAY = ['Эй, я мимо проходил!', 'А меня-то за что?!', 'У них тут свой праздник…', 'Ой-ой-ой…'];

// стиль удара участника в раунде r: бутыль разбивается о первую голову, дальше — кулаки
function brStyle(b, me, r) {
  const s = b.st[me];
  if (s === 'b') for (let q = 0; q < r; q++) if (+b.att[q] === me) return 'f';
  return s;
}

// ---------- Кадры (одинаково на сервере и у клиентов) ----------

function brawlPose(u) {
  const b = u.brawl;
  if (!b) return null;
  const e = Game.time - b.t0;
  if (e < 0) return null;
  if (b.k === 'fly') return brFlyPose(u, b, e);
  const i = Math.floor(e / BR_STEP), nF = b.R * BR_ROUND;
  const fa = u.face >= 0 ? -1 : 1;                      // знак поворота «на спину»
  const P = (f, extra) => Object.assign({ pose: 'fight', frame: f, dx: 0, dy: 0, lift: 0, rot: 0, off: 0, lying: false, f }, extra);
  if (i >= b.endI) return null;
  if (i < nF) {
    const r = Math.floor(i / BR_ROUND), s = i % BR_ROUND, a = +b.att[r], t = +b.tg[r];
    if (b.me === a) return P(BR_ATT[brStyle(b, b.me, r)][s], { atk: s === 3 ? brStyle(b, b.me, r) : '' });
    if (b.me === t) {
      const sty = brStyle(b, a, r), last = r === b.R - 1 && b.me === b.lose;
      const f = s === 2 ? (sty === 'f' ? 'parry' : 'ready') : s === 3 ? 'hurt' : s === 4 ? 'sg0' : s === 5 ? (last || r % 2 ? 'sg1' : 'ready') : 'ready';
      return P(f, { dx: s === 3 ? -u.face * 2 : s === 4 ? -u.face : 0 });
    }
    return P(s === 3 ? 'parry' : 'ready');
  }
  const j = i - nF;
  if (b.me !== b.lose) return P(j < BR_WIN ? (j & 1 ? 'win1' : 'win0') : 'ready');
  if (j < BR_FALL) return P('fl0', { rot: fa * [0.55, 1.1, 1.45][j] });
  if (j < BR_FALL + b.lie) return P('fl0', { rot: fa * Math.PI / 2, off: 2, lying: true });
  const q = j - BR_FALL - b.lie;
  return P(q === 0 ? 'sit' : q === 1 ? 'up0' : 'up1');
}

function brFlyPose(u, b, e) {
  const fa = u.face >= 0 ? -1 : 1;
  const P = (f, extra) => Object.assign({ pose: 'fight', frame: f, dx: 0, dy: 0, lift: 0, rot: 0, off: 0, lying: false, f }, extra);
  if (e < 0.12) return P('hurt', { dx: -u.face * 2 });
  if (e < 0.6) {
    const q = (e - 0.12) / 0.48;
    return P(q < 0.3 ? 'fy0' : q < 0.65 ? 'fy1' : 'fy2', { lift: 13 * Math.sin(Math.PI * q), rot: fa * (0.2 + 1.35 * q), fly: 1 });
  }
  if (e < 2.2) return P('fl0', { rot: fa * Math.PI / 2, off: 2, lying: true, slide: e < 0.85 ? 1 : 0 });
  if (e < 2.9) return P('sit');
  if (e < 3.15) return P('up0');
  if (e < BR_FLY_T) return P('up1');
  return null;
}

// удар в кадре, искры и пыль: рисуется поверх спрайта (render.js)
function brawlFx(c, u, bw, px, py) {
  const t = Game.time, f = u.face >= 0 ? 1 : -1;
  if (bw.atk) {
    const x = px + f * (bw.atk === 'k' ? 11 : 10), y = py - (bw.atk === 'k' ? 6 : 12);
    c.fillStyle = '#fff4a0'; c.fillRect(x - 1, y - 3, 2, 6); c.fillRect(x - 3, y - 1, 6, 2);
    c.fillStyle = '#ffffff'; c.fillRect(x, y, 1, 1);
    c.fillStyle = '#ffb040'; c.fillRect(x - 3, y - 3, 1, 1); c.fillRect(x + 2, y - 3, 1, 1); c.fillRect(x - 3, y + 2, 1, 1); c.fillRect(x + 2, y + 2, 1, 1);
    if (bw.atk === 'b') { c.fillStyle = '#b8f0c0'; c.fillRect(x + f * 3, y - 4, 1, 1); c.fillRect(x + f * 4, y + 2, 1, 1); c.fillRect(x - f, y + 4, 1, 1); }
  }
  if (bw.slide || bw.fly) {
    // пыль из-под спины: на лету — хвост позади, при скольжении — клубы
    const k = bw.slide ? (t * 9 + u.id) % 1 : 0.4;
    c.fillStyle = `rgba(214,196,150,${0.7 - k * 0.6})`;
    for (let j = 0; j < 3; j++) c.fillRect(Math.round(px - f * (6 + j * 4 + k * 5)), Math.round(py - 2 - j - k * 3), 2 + (j & 1), 2);
  }
}

// ---------- Звуки (общие SFX, лимит голосов — poly/cd) ----------

if (typeof SFX !== 'undefined' && typeof SFX_DEF !== 'undefined') {
  // кулак по скуле: глухой удар и шлепок кожи
  SFX.punch = (d, t, v) => {
    const r = 0.9 + v * 0.2;
    tone(d, 'sine', 170 * r, 55, t, 0.13, 0.6, 0.002);
    noiseHit(d, 'bandpass', 900 * r, 300, 1.2, t, 0.07, 0.35);
  };
  SFX_DEF.punch = { pri: 2, gain: 0.5, poly: 2, cd: 0.14, len: 0.2 };
  // пинок под зад: удар плотнее и ниже, с хрустом одежды
  SFX.kickhit = (d, t, v) => {
    const r = 0.9 + v * 0.2;
    tone(d, 'triangle', 130 * r, 45, t, 0.18, 0.65, 0.002);
    noiseHit(d, 'lowpass', 1400, 400, 0.8, t, 0.12, 0.3);
  };
  SFX_DEF.kickhit = { pri: 2, gain: 0.5, poly: 2, cd: 0.14, len: 0.25 };
  // «Ага!» и ругань дерущихся — голосом гнома
  SFX.brawlYell = (d, t, v) => gnomeVoice(d, t, [[240 + v * 70, 400, 0.12], [400, 260, 0.2]], 0.45, 800);
  SFX_DEF.brawlYell = { pri: 1, gain: 0.4, poly: 2, cd: 0.35, len: 0.4 };
  if (typeof FLOAT_SFX !== 'undefined') {
    Object.assign(FLOAT_SFX, { 'Бам!': 'punch', 'Пинок!': 'kickhit' });
    for (const s of BR_SHOUT) FLOAT_SFX[s] = 'brawlYell';
  }
}

// ---------- Ход драки (сервер и одиночная игра) ----------

function brFighter(u) {
  return u.brk && u.brk.kind === 'feast' && (u.fdrinks || 0) >= BR_DRINKS && !u.inside && !u.dead && !u.carry && !u.brawl && !u.rec && !u.gx && !u.gm && isPerson(u) &&
    u.type !== 'hero' && u.type !== 'carter' && !u.teamOf && !(u.fleeUntil > Game.time) && !(u.panicUntil > Game.time);
}
function brName(u) { return (UNIT_TYPES[u.type] ? UNIT_TYPES[u.type].name : 'гном').toLowerCase(); }

function brawlMaybeStart() {
  if (!festOn() || festThreat() || !startOpen('brawl') || Game.time < Game.brawlNext || Game.time - (Game.festival.t0 || 0) < BR_HELLO) return;
  if (Math.random() > BR_CHANCE) return;
  const cand = Game.units.filter(brFighter);
  if (cand.length < 2) return;
  const a = cand[(Math.random() * cand.length) | 0];
  const near = cand.filter(o => o !== a && Math.hypot(o.x - a.x, o.y - a.y) < 6).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
  if (!near.length) return;
  const fs = [a, near[0]];
  if (near.length > 1 && Math.random() < 0.35) fs.push(near[1]);
  brawlGather(fs);
}

// сходятся к общей точке
function brawlGather(fs, why) {   // why === 'mood': драка от тоски (mood.js), не на празднике
  const cx = fs.reduce((s, u) => s + u.x, 0) / fs.length, cy = fs.reduce((s, u) => s + u.y, 0) / fs.length;
  const free = (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)] && !World.door[idx(x, y)];
  const taken = [];
  const B = Game.brawl = { phase: 'gather', t0: Game.time, fs, cx, cy, ready: new Set(), hitHero: false, step: -1, abort: false };
  for (const u of fs) {
    startBreak(u, 'brawl', null);
    u.fun = null; u.flaskT = 0; u.gest = ''; u.gestUntil = 0;
    let s = null;
    for (let k = 0; k < 6 && !s; k++) {
      const c = randomFreeNear(Math.floor(cx), Math.floor(cy), 0, 1.8, free);
      if (c && !taken.some(q => q[0] === c[0] && q[1] === c[1])) s = c;
    }
    if (s) taken.push(s);
    u.proc = (function* () {
      if (s) { yield { walk: s, offroad: true }; B.ready.add(u); }
      while (u.brawl || Game.brawl === B) yield { wait: 0.2 };
    })();
  }
  floater(fs[0].x, fs[0].y - 1.4, BR_SHOUT[(Math.random() * BR_SHOUT.length) | 0], '#ffb090');
  if (why === 'mood') { logEvent('people', `От тоски ${fs.map(brName).join(' и ')} полезли в драку`, cx, cy); return; }
  logEvent('festival', `Пьяная драка на празднике: ${fs.map(brName).join(' и ')} не поделили кружку`, cx, cy);
  toast('На празднике назревает драка…');
}

function brawlBegin(B) {
  const fs = B.fs, n = fs.length, R = n === 2 ? 4 : 6;
  // кто куда смотрит и где стоит: пара — друг напротив друга, трое — треугольником
  const ox = n === 2 ? [-0.42, 0.42] : [-0.5, 0.5, 0], oy = n === 2 ? [0, 0] : [0.15, 0.15, -0.5];
  const order = fs.slice().sort((p, q) => p.x - q.x);
  if (n === 3 && order[1].y < order[2].y) { /* порядок по x достаточен */ }
  order.forEach((u, k) => {
    const x1 = B.cx + ox[k], y1 = B.cy + oy[k];
    if (isWalkable(Math.floor(x1), Math.floor(y1))) u.fiveSlide = { x0: u.x, y0: u.y, x1, y1, t0: Game.time };
  });
  let att = '', tg = '';
  const first = (Math.random() * n) | 0;
  for (let r = 0; r < R; r++) {
    const i = (first + r) % n;
    const t = n === 2 ? 1 - i : (i + 1 + (r >= 3 ? 1 : 0)) % n;
    att += i; tg += t;
  }
  const lose = +tg[R - 1], lie = 12 + ((Math.random() * 5) | 0);
  let st = '';
  for (let k = 0; k < n; k++) { const r = Math.random(); st += r < 0.45 ? 'f' : r < 0.75 ? 'k' : 'b'; }
  const t0 = Game.time + 0.4, nF = R * BR_ROUND;
  fs.forEach((u, k) => {
    u.brawl = { t0, me: k, n, att, tg, st, R, lose, lie, endI: k === lose ? nF + BR_FALL + lie + 3 : nF + BR_WIN };
    u.vdir = 'E'; u.anim = null;
  });
  B.phase = 'fight'; B.t0 = t0; B.R = R; B.att = att; B.tg = tg; B.lose = lose; B.lie = lie; B.step = -1; B.st = st;
  B.endT = t0 + (nF + BR_FALL + lie + 3) * BR_STEP + 0.3;
  Game.brawlN = (Game.brawlN || 0) + 1;
}

function brawlEnd(B, why) {
  for (const u of B.fs) { if (u.brawl && u.brawl.k !== 'fly') u.brawl = null; }
  Game.brawl = null;
  Game.brawlNext = Game.time + BR_GAP[0] + Math.random() * (BR_GAP[1] - BR_GAP[0]);
  if (why === 'done' && B.fs.length > 1) {
    const w = B.fs.filter((u, k) => k !== B.lose).map(brName).join(' и '), l = B.fs[B.lose];
    logEvent('festival', `Драка кончилась: победил ${w}, ${brName(l)} отдыхает в пыли`, B.cx, B.cy);
  }
}

// сразу по ходу драки: звук, слова, искры, герой под раздачу
function brawlHit(B, r) {
  const a = B.fs[+B.att[r]], t = B.fs[+B.tg[r]];
  const sty = brStyle(a.brawl, a.brawl.me, r);
  face2(a, t);
  const txt = sty === 'b' ? 'Дзынь!' : sty === 'k' ? 'Пинок!' : 'Бам!';
  floater(t.x, t.y - 1.3, txt, '#ffe070');
  fxBurst(t.x * TILE + (a.x < t.x ? -3 : 3), t.y * TILE - 16, sty === 'b' ? 9 : 6, sty === 'b' ? ['#b8f0c0', '#3f8a4a', '#ffffff'] : ['#fff2a0', '#ffffff', '#ffb040'], 36, 30, 0.35, 1.2, 120);
  if (!B.hitHero) brawlHeroCheck(B, (a.x + t.x) / 2, (a.y + t.y) / 2, a);
}
function face2(a, t) { if (Math.abs(a.x - t.x) > 0.02) { a.face = t.x > a.x ? 1 : -1; t.face = -a.face; } }

function brawlRun(B) {
  // нечисть, смерть, чужой перерыв — драка сворачивается
  if (festThreat() || B.fs.some(u => u.dead || !u.brk || u.brk.kind !== 'brawl')) { brawlEnd(B, 'abort'); return; }
  if (B.phase === 'gather') {
    if (B.ready.size >= B.fs.length) brawlBegin(B);
    else if (Game.time - B.t0 > 9) brawlEnd(B, 'late');      // не дошли — разошлись без драки
    return;
  }
  const i = Math.floor((Game.time - B.t0) / BR_STEP), nF = B.R * BR_ROUND;
  while (B.step < i) {
    B.step++;
    const k = B.step;
    if (k < 0) continue;
    if (k < nF) {
      const r = Math.floor(k / BR_ROUND), s = k % BR_ROUND;
      if (s === 0) {
        const a = B.fs[+B.att[r]], t = B.fs[+B.tg[r]];
        face2(a, t);
        for (const o of B.fs) if (o !== a && o !== t) o.face = t.x > o.x ? 1 : -1;
        if (r % 2 === 0 && Math.random() < 0.8) floater(a.x, a.y - 1.4, BR_SHOUT[(Math.random() * BR_SHOUT.length) | 0], '#ffb090');
      } else if (s === 3) brawlHit(B, r);
    } else {
      const j = k - nF;
      if (j === 0) {
        const w = B.fs[(B.lose + 1) % B.fs.length];
        floater(w.x, w.y - 1.4, ['Ура!', 'Хо-хо!', 'Эля!'][(Math.random() * 3) | 0], '#fff2a0');
      }
      if (j === 1) { const l = B.fs[B.lose]; floater(l.x, l.y - 1.2, 'Бух!', '#d8c8a0'); l.ouchUntil = Game.time + (BR_FALL + B.lie) * BR_STEP + 0.4; }
    }
  }
  if (Game.time >= B.endT) {
    // подъём с земли и пьяное «ик» — а дальше их снова затянет на праздник
    brawlEnd(B, 'done');
  }
}

function brawlTick(dt) {
  Game.brawlT = (Game.brawlT || 0) + dt;
  if (Game.brawl) { brawlRun(Game.brawl); return; }
  if (Game.brawlT < 1) return;
  Game.brawlT = 0;
  for (const u of Game.units) if (u.brawl && u.brawl.k === 'fly' && Game.time - u.brawl.t0 > BR_FLY_T + 0.2) u.brawl = null;   // оборвали приказом — не залипаем
  if (Game.brawlNext === undefined) Game.brawlNext = Math.max(Game.time, CYCLE * 2.2);
  brawlMaybeStart();
}

// ---------- Героя цепляет ----------

function brawlHeroOk(u) {
  const H = u.hero, now = Game.time;
  if (!H || u.dead || u.inside || u.brawl || u.rec || u.gx || u.gm) return false;
  if (H.downT || H.stunUntil > now || H.drunkUntil > now) return false;
  if (u.combatUntil > now || (u.anim && typeof FIGHT_ANIM_SET !== 'undefined' && FIGHT_ANIM_SET.has(u.anim)) || (u.hfx && u.hfx.t > now) || u.burn || u.glide || u.brk) return false;
  return true;
}

function brawlHeroCheck(B, cx, cy, hitter) {
  for (const h of Game.units) {
    if (h.type !== 'hero' || !h.hero || Math.hypot(h.x - cx, h.y - cy) > BR_HERO_R || !brawlHeroOk(h)) continue;
    if (Math.random() > 0.75) continue;
    B.hitHero = true;
    brawlHeroFly(h, cx, cy);
    return;
  }
}

function brawlHeroFly(u, cx, cy) {
  const H = u.hero, now = Game.time;
  let dx = u.x - cx, dy = u.y - cy, d = Math.hypot(dx, dy);
  if (d < 0.05) { dx = u.face ? -u.face : 1; dy = 0; d = 1; }
  dx /= d; dy /= d;
  // куда приземлится: до двух клеток, пока там можно стоять
  const ok = L => { const x = Math.floor(u.x + dx * L), y = Math.floor(u.y + dy * L); return isWalkable(x, y) && !World.door[idx(x, y)] && !World.bmap[idx(x, y)]; };
  let L = BR_HERO_FLY;
  while (L > 0.5 && !(ok(L) && ok(L * 0.5))) L -= 0.25;
  if (L <= 0.5) return;
  heroStopUnit(u);
  const x0 = u.x, y0 = u.y, tx = dx * L, ty = dy * L;
  u.face = tx > 0 ? -1 : 1; u.vdir = 'E';
  u.brawl = { k: 'fly', t0: now, me: 0, n: 1 };
  H.stunUntil = now + 2.9; u.cmd = null; u.ouchUntil = now + 2.8;
  const n = Math.max(1, Math.round(H.maxhp * 0.04));
  H.hp = Math.max(1, H.hp - n);               // не убивает: меньше одного хита не оставит
  floater(u.x, u.y - 1.8, '−' + n, '#ff8a70');
  floater(u.x, u.y - 1.3, 'Бам!', '#ffe070');
  if (typeof sfxAt === 'function') sfxAt('ouch', u.x * TILE, u.y * TILE);
  logEvent('festival', `${H.name} попал под раздачу в пьяной драке и отлетел на два шага`, u.x, u.y);
  toast(`${H.name} попал под раздачу в пьяной драке!`);
  let said = false;
  u.proc = (function* () {
    while (u.brawl && Game.time - u.brawl.t0 < BR_FLY_T) {
      const e = Game.time - u.brawl.t0;
      const q = Math.min(1, Math.max(0, (e - 0.12) / 0.62)), k = 1 - Math.pow(1 - q, 3);
      u.x = x0 + tx * k; u.y = y0 + ty * k;
      if (!said && e > 0.9) { said = true; floater(u.x, u.y - 1.7, BR_HERO_SAY[(Math.random() * BR_HERO_SAY.length) | 0], '#ffe8b0'); }
      yield { wait: 0.05 };
    }
    u.brawl = null;
  })();
  u.action = null;
}

// ---------- Сохранение ----------

function serializeBrawl() {
  if (Game.brawlNext === undefined && !Game.brawlN) return undefined;
  return { nx: Game.brawlNext, n: Game.brawlN || 0 };
}
function applyBrawl(s) {
  Game.brawl = null; Game.brawlNext = undefined; Game.brawlN = 0;
  if (!s) return;
  Game.brawlNext = s.nx; Game.brawlN = s.n || 0;
}
