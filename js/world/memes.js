'use strict';
// Мемы: лёгкий внутриигровой юмор, без политики и оскорблений. Гномы изредка выдают крылатые фразы и жесты:
//  • «6-7» — гном стоя качает ладонями вверх-вниз (жест six7 в people.js) и выкрикивает «Шесть-семь!»; сосед отвечает или повторяет.
//    Бывает в досуге, за играми гномов (games.js — у каждой игры своя реплика), на празднике (festival.js);
//  • ещё десяток гэгов по обстановке: золото в руках, пробка на дороге, призрак, ушибленный сосед, курьер, вывеска трактира, чертёж…
// Чтобы не надоедало: общая очередь (не чаще одного мема на деревню раз в ~MEME_GAP с), у каждого мема свой откат,
// в летопись попадают только заметные и не чаще раза в MEME_LOG_GAP. Состояние не сохраняется (мелочь), работает только у хозяина игры;
// надписи и жесты клиентам коопа приходят обычным путём (floater и поле gest).

const MEME_GAP = 55;          // сек между любыми двумя мемами на всю деревню
const MEME_LOG_GAP = 240;     // сек между записями о мемах в летописи
const MEME_LEISURE_P = 0.1;   // шанс, что досуг гнома обернётся «шесть-семь»
const MEME_Q_MAX = 2;         // сколько мемов ждёт очереди; остальные не копятся

function memeState() { return Game.memes || (Game.memes = { next: 0, logNext: 0, scan: 6, last: {}, q: [] }); }
const memePick = a => a[(Math.random() * a.length) | 0];
const memeMoving = u => !!(u.action && u.action.walk);
const memeFree = u => !u.dead && !u.inside && isPerson(u) && !u.hero && u.type !== 'carter' && !u.brk && !u.glide;
const memeDay = () => !isNightNow() && !isEveningNow();
function memeNear(u, r, f) {
  let best = null, bd = r;
  for (const o of Game.units) {
    if (o === u || !memeFree(o) || !f(o)) continue;
    const d = Math.hypot(o.x - u.x, o.y - u.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function memeLog(text, u) {
  const M = memeState();
  if (Game.time < M.logNext) return;
  M.logNext = Game.time + MEME_LOG_GAP;
  logEvent('people', text, u.x, u.y);
}

// ---------- «Шесть-семь» ----------

const SIX7_LINES = ['Шесть-семь!', '6-7!', 'Шесть… семь!'];
const SIX7_GAME = { plan: 'Шесть на семь локтей!', cards: 'Шесть-семь — моя масть!', knives: 'Шесть-семь! Мой кусок!', hop: 'Шесть… семь! Хоп!' };
const SIX7_ANSWER = ['Опять шесть-семь…', 'Это что вообще?', 'Не смешно. Ну, почти', 'Что за шесть-семь?'];

function six7Gesture(u, t) { u.gest = 'six7'; u.gestUntil = Game.time + t; u.gestFace = u.face; u.vdir = 'S'; }

function* six7Gen(u) {
  const M = memeState();
  M.last.six7 = Game.time; M.next = Game.time + MEME_GAP * (0.8 + Math.random() * 0.6);
  six7Gesture(u, 3);
  floater(u.x, u.y - 1.45, memePick(SIX7_LINES), '#ffe9a0');
  yield { wait: 1.4 };
  const o = memeNear(u, 6, p => !memeMoving(p) && !p.gp && !p.fun && p.idleFlag);
  if (o) {
    if (Math.random() < 0.4) { six7Gesture(o, 2.2); floater(o.x, o.y - 1.45, memePick(SIX7_LINES), '#ffe9a0'); }
    else { o.gest = 'scratch'; o.gestUntil = Game.time + 1.6; floater(o.x, o.y - 1.45, memePick(SIX7_ANSWER), '#e8e0c0'); }
  }
  yield { wait: 1.6 };
  u.gest = ''; u.gestUntil = 0;
  memeLog('«Шесть-семь!» — гном снова не удержался', u);
}

{
  const _le = leisureExtra;
  leisureExtra = function (u) {
    const M = memeState();
    if (!isMirror() && Game.time >= M.next && Game.time - (M.last.six7 || -1e9) > 150 && Math.random() < MEME_LEISURE_P && memeDay() && startOpen('games')
        && !(u.type === 'hero' || u.teamOf || u.rec || u.gx || u.gm || u.glide || u.gp)) return six7Gen(u);
    return _le(u);
  };
}

// ---------- Гэги по обстановке ----------
// cond(u) — подходит ли гном; say(u) — показать (true, если показали). cd — откат именно этого мема, сек; w — вес выбора.

const MEMES = [
  { id: 'six7game', cd: 200, w: 3,
    cond: u => memeFree(u) && u.gp && u.gp.here && SIX7_GAME[u.gp.k],
    say: u => { floater(u.x, u.y - 1.45, SIX7_GAME[u.gp.k], '#ffe9a0'); return true; } },
  { id: 'six7fest', cd: 120, w: 3,
    cond: u => memeFree(u) && festOn() && !memeMoving(u) && !u.fun && !(u.flaskT > Game.time) && !u.anim && !u.gp,
    say: u => { six7Gesture(u, 2.6); floater(u.x, u.y - 1.45, memePick(SIX7_LINES), '#ffe9a0'); return true; } },
  { id: 'doge', cd: 420, w: 2,
    cond: u => memeFree(u) && u.carry === 'gold' && memeDay(),
    say: u => { floater(u.x, u.y - 1.45, 'Вау. Много золото', '#ffe27a'); memeLog('«Такой гном. Много золото. Вау.»', u); return true; } },
  { id: 'normal', cd: 360, w: 2,
    cond: u => memeFree(u) && u.anim && typeof ANIM_TOOL !== 'undefined' && ANIM_TOOL[u.anim],
    say: u => { floater(u.x, u.y - 1.45, 'Нормально делай!', '#d8e8b0'); return true; } },
  { id: 'feature', cd: 360, w: 2,
    cond: u => memeFree(u) && u.action && u.action.block > 1.5,
    say: u => { floater(u.x, u.y - 1.45, 'Это не пробка, это фича', '#e8d8b0'); return true; } },
  { id: 'plan', cd: 420, w: 2,
    cond: u => memeFree(u) && u.gp && u.gp.here && u.gp.k === 'plan',
    say: u => { floater(u.x, u.y - 1.45, 'Не понятно, но интересно', '#cfe0ff'); return true; } },
  { id: 'ghost', cd: 500, w: 2,
    cond: u => memeFree(u) && (Game.ghosts || []).some(g => g.kind !== 'reaper' && g.alpha > 0.5 && Math.hypot(g.x - u.x, g.y - u.y) < 5),
    say: u => { floater(u.x, u.y - 1.45, 'Ты кто такой? До свидания!', '#dcecff'); return true; } },
  { id: 'calm', cd: 420, w: 2,
    cond: u => memeFree(u) && u.anim === 'freeze',
    say: u => { floater(u.x, u.y - 1.45, 'Только спокойствие!', '#dcecff'); return true; } },
  { id: 'laugh', cd: 360, w: 2,
    cond: u => memeFree(u) && (u.anim === 'knocked' || u.ouchUntil > Game.time) && memeNear(u, 4.5, o => !o.anim && !memeMoving(o)),
    say: u => { const o = memeNear(u, 4.5, p => !p.anim && !memeMoving(p)); if (!o) return false; floater(o.x, o.y - 1.45, 'Ор выше гор!', '#fff2a0'); return true; } },
  { id: 'courier', cd: 480, w: 1,
    cond: u => !u.dead && !u.inside && u.type === 'serf' && u.carry,
    say: u => { floater(u.x, u.y - 1.6, 'Доставка: шесть-семь минут', '#e8d8b0'); return true; } },
];
const MEME_BOARDS = ['Меню дня: шесть-семь', 'Борщ сегодня. Завтра тоже', 'Эль: пей — не жалей', 'Вай-фая нет, зато есть эль', 'Закуска — 6, эль — 7', 'Ничего не помню — наливай'];
MEMES.push({ id: 'board', cd: 300, w: 2, inn: true });     // надпись мелом на вывеске трактира

function memeInns() { return Game.buildings.filter(b => b.type === 'inn' && b.state === 'done' && !b.removed); }

// Кандидаты: один проход по гномам на весь перебор (раз в ~10 с)
function memeCandidates() {
  const M = memeState(), out = [], now = Game.time;
  for (const m of MEMES) {
    if (now - (M.last[m.id] || -1e9) < m.cd || M.q.some(e => e.id === m.id)) continue;
    if (m.inn) { const inns = memeInns(); if (inns.length && memeDay()) out.push({ m, inn: memePick(inns) }); continue; }
    const pool = [];
    for (const u of Game.units) if (m.cond(u)) pool.push(u);
    if (pool.length) out.push({ m, u: memePick(pool) });
  }
  return out;
}

function memeShow(e) {
  if (e.inn) {
    const b = e.inn;
    if (b.removed || b.state !== 'done') return false;
    floater(b.doorX + 0.5, b.doorY - 1.3, memePick(MEME_BOARDS), '#ffe9b0');
    return true;
  }
  if (!e.m.cond(e.u)) return false;                   // пока ждал в очереди, гном занялся другим
  return !!e.m.say(e.u);
}

function memesTick(dt) {
  const M = memeState(), now = Game.time;
  if (now < (M.seen || 0) - 1) { M.last = {}; M.next = 0; M.logNext = 0; M.q.length = 0; }       // началась другая игра: время пошло заново
  M.seen = now;
  M.scan -= dt;
  if (M.scan <= 0) {
    M.scan = 9 + Math.random() * 6;
    if (M.q.length < MEME_Q_MAX && Math.random() < 0.5) {
      const c = memeCandidates();
      if (c.length) {
        let r = Math.random() * c.reduce((s, e) => s + e.m.w, 0), pick = c[0];
        for (const e of c) { r -= e.m.w; if (r <= 0) { pick = e; break; } }
        M.q.push({ id: pick.m.id, t: now, m: pick.m, u: pick.u, inn: pick.inn });
      }
    }
  }
  while (M.q.length && now - M.q[0].t > 30) M.q.shift();        // протухшее не показываем
  if (now >= M.next && M.q.length) {
    const e = M.q.shift();
    if (memeShow(e)) { M.last[e.id] = now; M.next = now + MEME_GAP * (0.8 + Math.random() * 0.6); }
  }
}

{
  const _step = step;
  step = function (dt) { _step(dt); if (!isMirror()) memesTick(dt); };
}

if (typeof FLOAT_SFX !== 'undefined') {
  for (const t of [...SIX7_LINES, ...Object.values(SIX7_GAME)]) FLOAT_SFX[t] = 'hey';
  FLOAT_SFX['Ор выше гор!'] = 'cheer';
}
