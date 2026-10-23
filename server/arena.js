'use strict';
// Арена онлайн (АРЕНА.md, этап 3): бой 1 на 1 на общих комнатах server/rooms.js (вид 'arena').
// Сервер авторитетен: крутит ядро js/arena/arenasim.js ровно 20 тактов в секунду, игроки шлют только намерения
// (направление, слот способности, перекат, точка наведения). Клиент получает ВХОДЫ обоих игроков по тактам
// (кадры, 10 раз в секунду) и сам крутит то же ядро; раз в секунду — полный снимок, который гасит расхождение
// (Math.sin/cos в разных браузерах чуть отличаются). Подделать урон, позицию, откат или здоровье нельзя: их нет в сообщениях.
// Здесь же очередь подбора по Эло, вызов по коду, рейтинг и лиги (Опилки → Старое золото), таблица лидеров и защита от накруток.
// Состояние рейтинга — arena.json в папке данных (запись tmp+rename). Подключается из server.js одним вызовом createArena.

const fs = require('fs');
const path = require('path');
const A = require('../js/arena/arenasim.js');

const LEAGUES = [['Опилки', 0], ['Солома', 900], ['Глина', 1100], ['Ржавое железо', 1300], ['Чугун', 1550], ['Старое золото', 1800]];
const leagueOf = elo => { let i = 0; for (let k = 0; k < LEAGUES.length; k++) if (elo >= LEAGUES[k][1]) i = k; return i; };
const goodCls = c => typeof c === 'string' && Object.prototype.hasOwnProperty.call(A.ARENA_KIT, c);
const ELO0 = 1000, ELO_MIN = 400;
const DT = A.ARENA_TUNE.dt;                  // 0,05 с — один такт
const PAUSE_MS = 20000;                      // сколько ждём вернувшегося после обрыва
const MATCH_MAX_MS = 8 * 60000;              // зависший бой закрываем
const SNAP_EVERY = 20;                       // полный снимок раз в секунду
const FRAME_EVERY = 2;                       // кадры входов — каждые 2 такта (10 Гц)
const PAIR_PER_HOUR = 3;                     // рейтинговых боёв одной пары в час, дальше — только дружеские
const FAST_SURRENDER = 15;                   // сдача раньше 15 с боя рейтинга не двигает (продажа побед по уговору)
const STREAK_FLAG = 10;                      // подозрительная серия: 10 побед подряд над одним ником за сутки
const SHORT_FLAG = 20;                       // или 20 боёв короче 20 с

// Эло: K = 40 первые 10 боёв, 24 до 1600, 16 выше; счёт 2:0 даёт ×1,15
const kOf = P => (P.games < 10 ? 40 : P.elo < 1600 ? 24 : 16);
function eloDelta(Pw, Pl, dry) {
  const ew = 1 / (1 + Math.pow(10, (Pl.elo - Pw.elo) / 400));
  const k = (dry ? 1.15 : 1);
  return { w: Math.max(1, Math.round(kOf(Pw) * (1 - ew) * k)), l: Math.max(1, Math.round(kOf(Pl) * ew * k)) };
}

// Вход игрока: чистим ядром (мусор, NaN, прототипные ключи отбрасываются), «разовые» поля (каст, перекат) живут до такта
function cleanIn(m) {
  const o = A.arenaInput(m);
  return { mx: o.mx, my: o.my, cast: o.cast, roll: o.roll, aim: o.aim };
}
// компактная запись входа в кадре: [mx*100, my*100, cast, roll, aimx*10, aimy*10] — пустой вход → 0
const packIn = o => (!o ? 0 : (o.mx === 0 && o.my === 0 && o.cast < 0 && !o.roll && !o.aim) ? 0 : [Math.round(o.mx * 100), Math.round(o.my * 100), o.cast, o.roll, o.aim ? Math.round(o.aim[0] * 10) : 0, o.aim ? Math.round(o.aim[1] * 10) : 0]);

function createArena(opts) {
  const o = Object.assign({ DATA: '.', log: () => {}, now: () => Date.now(), rooms: null, saveEvery: 30000, boardEvery: 60000 }, opts);
  const FILE = path.join(o.DATA, 'arena.json');
  const pl = Object.create(null);          // ключ аккаунта → { nick, elo, games, wins, streak, best, hide, cls:{}, last, flags }
  let matches = [];                         // последние 500 боёв кратко (анти-накрутка)
  let dirty = false, board = { at: 0, top: [] };
  const queue = [];                         // { key, nick, cls, since, send }
  const stat = { matches: 0, rated: 0, flagged: 0 };
  try {
    const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    for (const k of Object.keys(j.players || {})) if (k !== '__proto__') pl[k] = j.players[k];
    matches = Array.isArray(j.matches) ? j.matches.slice(-500) : [];
  } catch (e) { /* первый запуск */ }

  function save() {
    if (!dirty) return;
    dirty = false;
    try {
      const tmp = FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ v: 1, players: pl, matches: matches.slice(-500) }));
      fs.renameSync(tmp, FILE);
    } catch (e) { o.log('арена: не записался arena.json', e.message); dirty = true; }
  }
  const saveTimer = setInterval(save, o.saveEvery);
  if (saveTimer.unref) saveTimer.unref();

  function P(key, nick) {
    let p = pl[key];
    if (!p) { p = pl[key] = { nick, elo: ELO0, games: 0, wins: 0, streak: 0, best: ELO0, hide: false, cls: {}, last: 0, flags: 0 }; dirty = true; }
    if (nick && p.nick !== nick) { p.nick = nick; dirty = true; }
    return p;
  }
  const me = key => { const p = pl[key]; return p ? { elo: p.elo, lg: leagueOf(p.elo), games: p.games, wins: p.wins, streak: p.streak, hide: !!p.hide } : { elo: ELO0, lg: leagueOf(ELO0), games: 0, wins: 0, streak: 0, hide: false }; };

  // ---------- Таблица лидеров: топ-50, раз в минуту; скрывшие себя пропускаются ----------
  function topBoard() {
    const t = o.now();
    if (t - board.at > o.boardEvery) {
      board.at = t;
      board.top = Object.keys(pl).filter(k => !pl[k].hide && pl[k].games > 0).sort((a, b) => pl[b].elo - pl[a].elo || pl[b].wins - pl[a].wins).slice(0, 50)
        .map(k => { const p = pl[k], fav = Object.keys(p.cls).sort((a, b) => p.cls[b] - p.cls[a])[0] || ''; return { key: k, nick: p.nick, elo: p.elo, lg: leagueOf(p.elo), games: p.games, wins: p.wins, cls: fav }; });
    }
    return board.top;
  }
  function boardFor(key) {
    const top = topBoard();
    let place = 0;
    if (pl[key] && !pl[key].hide && pl[key].games > 0) {
      const mine = pl[key].elo, ahead = Object.keys(pl).filter(k => !pl[k].hide && pl[k].games > 0 && (pl[k].elo > mine || (pl[k].elo === mine && pl[k].wins > pl[key].wins))).length;
      place = ahead + 1;
    }
    return { top: top.map(r => ({ nick: r.nick, elo: r.elo, lg: r.lg, games: r.games, wins: r.wins, cls: r.cls })), place, me: me(key) };
  }
  function setHide(key, on) { const p = pl[key]; if (!p) return; p.hide = !!on; board.at = 0; dirty = true; }
  // «Удалить мои данные» главного сервера: рейтинг и записи об этом игроке стираются
  function forget(key) {
    if (!pl[key]) return;
    const nick = pl[key].nick;
    delete pl[key];
    matches = matches.filter(m => m.a !== key && m.b !== key);
    board.at = 0; dirty = true;
    qLeave(key);
    o.log(`арена: данные ${nick} удалены`);
  }

  // ---------- Результат боя: Эло, лиги, защита от накруток ----------
  // res: { a:{key,nick,cls}, b:{...}, w:0|1, score:[x,y], fightT (секунд боя), sur:-1|0|1, tech:bool, rated:bool }
  function settle(res) {
    const t = o.now();
    stat.matches++;
    const A_ = P(res.a.key, res.a.nick), B_ = P(res.b.key, res.b.nick);
    const W = res.w === 0 ? A_ : B_, L = res.w === 0 ? B_ : A_, wk = res.w === 0 ? res.a.key : res.b.key, lk = res.w === 0 ? res.b.key : res.a.key;
    const out = [{ d: 0, why: '' }, { d: 0, why: '' }];
    const wi = res.w, li = 1 - res.w;
    let rated = !!res.rated, why = '';
    if (rated) {
      // пара не чаще PAIR_PER_HOUR рейтинговых боёв в час (обмен победами)
      const hour = matches.filter(m => m.rated && t - m.t < 3600000 && ((m.a === res.a.key && m.b === res.b.key) || (m.a === res.b.key && m.b === res.a.key))).length;
      if (hour >= PAIR_PER_HOUR) { rated = false; why = 'pair'; }
      else if (res.sur >= 0 && res.fightT < FAST_SURRENDER) { rated = false; why = 'fast'; }
      else if (res.a.ip && res.a.ip === res.b.ip) { rated = false; why = 'ip'; }   // два окна с одного адреса не меряются рейтингом
    }
    if (rated) {
      const dry = res.score[li] === 0 && !res.tech;
      const d = eloDelta(W, L, dry);
      // отключение: техническое поражение отключившегося — вдвое меньше, если он вёл по здоровью (раздел 12), иначе полное
      const half = res.tech && res.halfLoss ? 0.5 : 1;
      const dl = Math.max(1, Math.round(d.l * half));
      const nw = W.elo + d.w, nl = Math.max(ELO_MIN, L.elo - dl);
      out[wi] = { d: d.w, why: '' }; out[li] = { d: nl - L.elo, why: '' };
      W.elo = nw; L.elo = nl;
      W.best = Math.max(W.best || ELO0, W.elo);
      stat.rated++;
    } else { out[0].why = out[1].why = why || 'friendly'; }
    // бои, не двигавшие рейтинг (дружеские, пара, быстрая сдача, один адрес), в счётчики побед не идут
    if (rated) {
      for (const [p, won, c] of [[W, true, res.w === 0 ? res.a.cls : res.b.cls], [L, false, res.w === 0 ? res.b.cls : res.a.cls]]) {
        p.games++; if (won) { p.wins++; p.streak++; } else p.streak = 0;
        p.cls[c] = (p.cls[c] || 0) + 1; p.last = t;
      }
    }
    const rec = { t, a: res.a.key, b: res.b.key, w: wk, l: lk, rated, dur: Math.round(res.fightT) };
    matches.push(rec); if (matches.length > 500) matches.shift();
    // подозрительные серии — в журнал и в счётчик, решение за владельцем (без автобана)
    if (rated) {
      const day = matches.filter(m => m.rated && t - m.t < 86400000);
      const wins = day.filter(m => m.w === wk && m.l === lk).length, back = day.filter(m => m.w === lk && m.l === wk).length;
      if (wins >= STREAK_FLAG && !back) flag(W, `${W.nick}: ${wins} побед над ${L.nick} за сутки без ответа`);
      const shorts = day.filter(m => (m.a === wk || m.b === wk) && m.dur < 20).length;
      if (shorts >= SHORT_FLAG) flag(W, `${W.nick}: ${shorts} боёв короче 20 с за сутки`);
    }
    dirty = true; board.at = 0;
    save();
    return { out, rated, why };
  }
  function flag(p, text) { p.flags = (p.flags || 0) + 1; stat.flagged++; o.log('арена: подозрительно —', text); }

  // ---------- Комната-бой (вид 'arena' для server/rooms.js) ----------
  const kind = { max: 2 };
  const slot = (r, key) => (r.game ? r.game.keys.indexOf(key) : -1);

  kind.start = r => {
    const ms = [...r.members.values()];
    const seed = ((Math.random() * 2147483646) | 0) + 1;
    const cls = ms.map(m => m.cls), nm = ms.map(m => m.nick);
    const S = A.arenaNew({ seed, cls, nm });
    r.game = { S, keys: ms.map(m => m.key), inp: [cleanIn(null), cleanIn(null)], acc: 0, frames: [], t0: o.now(), paused: 0, pausedBy: -1, pauseLeft: 0, used: [0, 0], ended: false, sinceSnap: 0, nm, rated: !!r.opts.rated };
    const G = r.game;
    for (const m of ms) m.send({ t: 'arena', a: 'go', me: G.keys.indexOf(m.key), seed, cls, nm, rated: G.rated, tune: S.v, proto: A.ARENA_PROTO, snap: S });
  };
  // такт: подаём входы, шагаем ядро. Разовые поля (каст, перекат) сбрасываются после такта
  kind.tick = (r, dt) => {
    const G = r.game; if (!G || G.ended) return;
    const t = o.now();
    if (t - G.t0 > MATCH_MAX_MS) { return finishMatch(r, -1, { cancel: true }); }
    if (G.paused) {
      if (t - G.paused > PAUSE_MS) { return forfeit(r, G.pausedBy, true); }
      return;
    }
    G.acc = Math.min(G.acc + dt, DT * 6);
    while (G.acc >= DT && !G.ended) {
      G.acc -= DT;
      const S = G.S;
      A.arenaStep(S, G.inp.map(x => ({ mx: x.mx, my: x.my, cast: x.cast, roll: x.roll, aim: x.aim })));
      G.frames.push([S.tick, packIn(G.inp[0]), packIn(G.inp[1])]);
      for (const x of G.inp) { x.cast = -1; x.roll = 0; }
      G.sinceSnap++;
      if (S.phase === 'over') { flush(r, true); return endByCore(r); }
      if (G.frames.length >= FRAME_EVERY) flush(r, false);
      if (G.sinceSnap >= SNAP_EVERY) { G.sinceSnap = 0; snap(r); }
    }
  };
  function flush(r, force) {
    const G = r.game; if (!G.frames.length) return;
    const msg = { t: 'arena', a: 'f', f: G.frames.splice(0) };
    for (const m of r.members.values()) if (!m.away) m.send(msg);
    void force;
  }
  function snap(r) {
    const G = r.game, msg = { t: 'arena', a: 's', s: G.S };
    for (const m of r.members.values()) if (!m.away) m.send(msg);
  }
  function endByCore(r) {
    const G = r.game, S = G.S;
    const w = S.winner;
    finishMatch(r, w, { sur: S.sur, score: S.score.slice() });
  }
  function forfeit(r, loser, tech) {
    const G = r.game; if (!G || G.ended || loser < 0) return;
    const S = G.S;
    // отключение при здоровье соперника < 25%… наоборот: отключился тот, кто проигрывал (здоровье < 25%) — полное поражение
    const F = S.f[loser], low = F.hp / F.mhp < 0.25 || S.score[1 - loser] > S.score[loser];
    S.winner = 1 - loser; S.phase = 'over';
    if (tech) { G.halfLoss = !low; }
    finishMatch(r, 1 - loser, { sur: tech ? -1 : loser, score: S.score.slice(), tech: !!tech, halfLoss: G.halfLoss });
  }
  function finishMatch(r, w, x) {
    const G = r.game; if (!G || G.ended) return;
    G.ended = true;
    const ms = [...r.members.values()];
    const S = G.S;
    let outInfo = null;
    const fightT = Math.max(0, S.tick * DT - 3);
    if (w >= 0 && !x.cancel) {
      const side = i => { const m = r.members.get(G.keys[i]) || {}; return { key: G.keys[i], nick: G.nm[i], cls: S.f[i].cls, ip: m.ip || '' }; };
      outInfo = settle({ a: side(0), b: side(1), w, score: x.score || S.score.slice(), fightT, sur: x.sur == null ? -1 : x.sur, tech: !!x.tech, halfLoss: !!x.halfLoss, rated: G.rated });
    }
    for (const m of ms) {
      if (m.away) continue;
      const i = G.keys.indexOf(m.key), mine = me(m.key);
      m.send({ t: 'arena', a: 'end', w, score: x.score || S.score.slice(), sur: x.sur == null ? -1 : x.sur, tech: !!x.tech, cancel: !!x.cancel, rated: !!(outInfo && outInfo.rated), why: outInfo ? outInfo.out[i].why : '',
        d: outInfo ? outInfo.out[i].d : 0, me: mine, tick: S.tick });
    }
    o.log(`арена ${r.code}: ${x.cancel ? 'отменён' : w >= 0 ? `победил ${G.nm[w]} ${(S.score || []).join(':')}` : 'без итога'}${G.rated ? ' (рейтинг)' : ''}`);
    r.endedAt = o.now();
    if (o.rooms) o.rooms.finish(r);
    // комната закрывается сразу: следующий бой — через новую очередь или вызов (итог уже отправлен)
    if (o.rooms) for (const k of G.keys) { if (o.rooms.roomOf(k) === r) o.rooms.leave(k, 'конец боя'); }
  }
  kind.input = (r, key, m) => {
    const G = r.game; if (!G || G.ended) return;
    const i = G.keys.indexOf(key); if (i < 0) return;
    const c = cleanIn(m), cur = G.inp[i];
    cur.mx = c.mx; cur.my = c.my; cur.aim = c.aim;
    if (c.cast >= 0) cur.cast = c.cast;
    if (c.roll) cur.roll = 1;
  };
  kind.quit = (r, key) => {
    const G = r.game; if (!G || G.ended) return;
    const i = G.keys.indexOf(key); if (i < 0) return;
    const S = G.S;
    if (A.arenaSurrender(S, i)) { flush(r, true); finishMatch(r, 1 - i, { sur: i, score: S.score.slice() }); }
  };
  // обрыв связи: пауза на 20 с (один раз на игрока), вторая — техническое поражение
  kind.away = (r, m) => {
    const G = r.game; if (!G || G.ended) return;
    const i = G.keys.indexOf(m.key); if (i < 0) return;
    if (G.used[i]) return forfeit(r, i, true);
    G.used[i] = 1; G.paused = o.now(); G.pausedBy = i;
    for (const x of r.members.values()) if (!x.away) x.send({ t: 'arena', a: 'pause', who: i, left: PAUSE_MS / 1000 });
  };
  kind.back = (r, m) => {
    const G = r.game; if (!G) return;
    const i = G.keys.indexOf(m.key); if (i < 0) return;
    if (G.ended) { m.send({ t: 'arena', a: 'end', w: G.S.winner, score: G.S.score.slice(), cancel: true, me: me(m.key), d: 0, rated: false }); return; }
    if (G.pausedBy === i) { G.paused = 0; G.pausedBy = -1; }
    m.send({ t: 'arena', a: 'go', me: i, seed: G.S.seed, cls: G.S.f.map(f => f.cls), nm: G.nm, rated: G.rated, tune: G.S.v, proto: A.ARENA_PROTO, snap: G.S });
    for (const x of r.members.values()) if (!x.away) x.send({ t: 'arena', a: 'resume' });
  };
  kind.leave = (r, m, why) => {
    const G = r.game; if (!G || G.ended) return;
    const i = G.keys.indexOf(m.key); if (i < 0) return;
    if (why === 'конец боя') return;
    forfeit(r, i, why === 'не вернулся' || why === 'обрыв');
  };
  kind.end = r => { const G = r.game; if (G && !G.ended) finishMatch(r, -1, { cancel: true }); };

  // ---------- Очередь и подбор ----------
  function qLeave(key) {
    const i = queue.findIndex(q => q.key === key);
    if (i >= 0) queue.splice(i, 1);
  }
  const inQueue = key => queue.some(q => q.key === key);
  function qAdd(m, cls) {
    if (!o.rooms) return { err: 'арена выключена' };
    if (o.rooms.roomOf(m.key)) return { err: 'вы уже в бою или в комнате' };
    if (!goodCls(cls)) return { err: 'неизвестный класс' };
    if (queue.length >= 200) return { err: 'арена переполнена, подождите' };
    qLeave(m.key);
    P(m.key, m.nick);
    queue.push({ key: m.key, nick: m.nick, cls, since: o.now(), send: m.send, ip: m.ip || '' });
    return { ok: true };
  }
  // окно по Эло: ±100, плюс 50 каждые 5 с ожидания, потолок ±400
  const windowOf = q => Math.min(400, 100 + 50 * Math.floor((o.now() - q.since) / 5000));
  function pairUp() {
    for (let i = 0; i < queue.length; i++) {
      const a = queue[i];
      for (let j = i + 1; j < queue.length; j++) {
        const b = queue[j];
        const ea = pl[a.key].elo, eb = pl[b.key].elo, w = Math.max(windowOf(a), windowOf(b));
        if (Math.abs(ea - eb) > w) continue;
        // одна и та же пара — не больше PAIR_PER_HOUR рейтинговых боёв в час: иначе ищем другого
        const t = o.now();
        const hour = matches.filter(m => m.rated && t - m.t < 3600000 && ((m.a === a.key && m.b === b.key) || (m.a === b.key && m.b === a.key))).length;
        if (hour >= PAIR_PER_HOUR && queue.length > 2) continue;
        queue.splice(j, 1); queue.splice(i, 1);
        return startRoom(a, b, true);
      }
    }
  }
  function startRoom(a, b, rated, code) {
    const x = o.rooms.create('arena', a, { rated });
    if (x.err) { a.send({ t: 'arena', a: 'err', msg: x.err }); b.send({ t: 'arena', a: 'err', msg: x.err }); return; }
    const r = x.room;
    r.members.get(a.key).cls = a.cls; r.members.get(a.key).ip = a.ip || '';
    const y = o.rooms.join(r.code, b);
    if (y.err) { o.rooms.leave(a.key); a.send({ t: 'arena', a: 'err', msg: y.err }); b.send({ t: 'arena', a: 'err', msg: y.err }); return; }
    r.members.get(b.key).cls = b.cls; r.members.get(b.key).ip = b.ip || '';
    for (const m of r.members.values()) m.ready = true;
    const s = o.rooms.start(a.key);
    if (s.err) { o.rooms.leave(a.key); o.rooms.leave(b.key); return; }
    void code;
  }
  const mm = setInterval(() => {
    try {
      let n = 0;
      while (n++ < 50 && pairUp());
      const t = o.now();
      for (const q of queue) { if (t - (q.told || 0) >= 2000) { q.told = t; q.send({ t: 'arena', a: 'wait', s: Math.round((t - q.since) / 1000), n: queue.length, w: windowOf(q), bot: t - q.since >= 20000 }); } }
    } catch (e) { o.log('арена: ошибка подбора', e.message); }
  }, 1000);
  if (mm.unref) mm.unref();

  // ---------- Вызов по коду: создатель ждёт, второй вводит код; бой дружеский ----------
  const invites = new Map();   // код → { m (создатель), cls, at }
  function inviteMake(m, cls) {
    if (!o.rooms) return { err: 'арена выключена' };
    if (o.rooms.roomOf(m.key) || inQueue(m.key)) return { err: 'вы уже в очереди или в бою' };
    if (!goodCls(cls)) return { err: 'неизвестный класс' };
    for (const [c, v] of invites) if (v.key === m.key || o.now() - v.at > 600000) invites.delete(c);   // код живёт 10 минут, один на игрока
    let code = '';
    for (let k = 0; k < 50 && !code; k++) { const c = String(100000 + ((Math.random() * 900000) | 0)); if (!invites.has(c)) code = c; }
    if (!code) return { err: 'не нашлось свободного кода' };
    P(m.key, m.nick);
    invites.set(code, { key: m.key, nick: m.nick, cls, at: o.now(), send: m.send, ip: m.ip || '' });
    return { code };
  }
  function inviteTake(m, code, cls) {
    const v = invites.get(String(code || '').replace(/\D/g, '').slice(0, 6));
    if (!v || o.now() - v.at > 600000) return { err: 'вызова с таким кодом нет или он устарел' };
    if (v.key === m.key) return { err: 'это ваш собственный код' };
    if (!goodCls(cls)) return { err: 'неизвестный класс' };
    if (o.rooms.roomOf(m.key) || inQueue(m.key)) return { err: 'вы уже в очереди или в бою' };
    if (o.rooms.roomOf(v.key)) { invites.delete(String(code)); return { err: 'соперник уже в бою' }; }
    invites.delete(String(code).replace(/\D/g, '').slice(0, 6));
    qLeave(v.key);
    P(m.key, m.nick);
    startRoom(v, { key: m.key, nick: m.nick, cls, send: m.send, ip: m.ip || '' }, false);
    return { ok: true };
  }
  function inviteCancel(key) { for (const [c, v] of invites) if (v.key === key) invites.delete(c); }

  // ---------- Сообщения клиента ----------
  // m — разобранное сообщение {t:'arena', a:…}; c — { key, nick, send, ip }
  function onMessage(c, m) {
    const act = typeof m.a === 'string' ? m.a : '';
    const who = { key: c.key, nick: c.nick, send: c.send, ip: c.ip || '' };
    switch (act) {
      case 'hello': c.send({ t: 'arena', a: 'state', proto: A.ARENA_PROTO, tune: A.ARENA_TUNE.v, me: me(c.key), queue: queue.length, leagues: LEAGUES.map(l => l[0]) }); return;
      case 'queue': { const x = qAdd(who, m.cls); if (x.err) c.send({ t: 'arena', a: 'err', msg: x.err }); else c.send({ t: 'arena', a: 'queued', n: queue.length }); return; }
      case 'leave': qLeave(c.key); inviteCancel(c.key); c.send({ t: 'arena', a: 'left' }); return;
      case 'invite': { const x = inviteMake(who, m.cls); if (x.err) c.send({ t: 'arena', a: 'err', msg: x.err }); else c.send({ t: 'arena', a: 'invite', code: x.code }); return; }
      case 'accept': { const x = inviteTake(who, m.code, m.cls); if (x.err) c.send({ t: 'arena', a: 'err', msg: x.err }); return; }
      case 'surrender': { const r = o.rooms.roomOf(c.key); if (r && r.kind === 'arena' && r.state === 'play') kind.quit(r, c.key); return; }
      case 'forget': forget(c.key); c.send({ t: 'arena', a: 'state', proto: A.ARENA_PROTO, tune: A.ARENA_TUNE.v, me: me(c.key), queue: queue.length, leagues: LEAGUES.map(l => l[0]) }); return;
      case 'board': c.send(Object.assign({ t: 'arena', a: 'board' }, boardFor(c.key))); return;
      case 'hide': setHide(c.key, !!m.on); c.send({ t: 'arena', a: 'state', proto: A.ARENA_PROTO, tune: A.ARENA_TUNE.v, me: me(c.key), queue: queue.length, leagues: LEAGUES.map(l => l[0]) }); return;
      case 'resume': { const r = o.rooms.roomOf(c.key); if (r && r.kind === 'arena') { /* возврат обрабатывает rooms.join по коду */ c.send({ t: 'arena', a: 'room', code: r.code }); } return; }
    }
  }
  // ввод боя идёт мимо общего ведра (20–25 в секунду) — своё ведро 30/с здесь
  function onInput(c, m) {
    const t = o.now();
    if (t - (c.ainAt || 0) > 1000) { c.ainAt = t; c.ainN = 0; }
    if (++c.ainN > 30) { if ((c.ainBad = (c.ainBad || 0) + 1) > 300) return 'flood'; return; }
    const r = o.rooms && o.rooms.roomOf(c.key);
    if (r && r.kind === 'arena' && r.state === 'play') kind.input(r, c.key, m);
  }
  // соединение оборвалось / вернулось
  function onDrop(key) { qLeave(key); inviteCancel(key); }
  function onBack(c) {
    const r = o.rooms && o.rooms.roomOf(c.key);
    if (r && r.kind === 'arena') o.rooms.join(r.code, { key: c.key, nick: c.nick, send: c.send });
  }
  function info() { return { queue: queue.length, rooms: o.rooms ? [...o.rooms.rooms.values()].filter(r => r.kind === 'arena').length : 0, players: Object.keys(pl).length, matches: stat.matches, rated: stat.rated, flagged: stat.flagged }; }
  function stop() { clearInterval(mm); clearInterval(saveTimer); save(); }

  return { kind, onMessage, onInput, onDrop, onBack, forget, info, save, stop, settle, me, boardFor, leagueOf, queue, pl, matches: () => matches, LEAGUES, setHide, pairUp, qAdd, qLeave, inviteMake, inviteTake };
}

module.exports = { createArena, leagueOf, eloDelta, LEAGUES };
