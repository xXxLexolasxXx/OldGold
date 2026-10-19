'use strict';
// Поле боя (см. БОЁВКА.md): герой ставит у себя под ногами капкан [N], колья [M] и боевой фонарь [J].
// Не здания и не клетки карты: свой список Game.cbfield (сохраняется, в общей деревне зеркалится клиентам, считает сервер).
//   капкан   — взводится за 1,5 с; первый враг в нём получает урон, оглушение и становится «открытым» (см. combat.js)
//   колья    — рвут и замедляют всех, кто на них налез; ломаются после нескольких касаний
//   фонарь   — 50 с жжёт скелетов светом, пугает ходячие деревья, замедляет тронутых лесных жителей
// Откаты у каждого героя свои (H.cfCd); у разбойника и лучника капканы быстрее, у воина колья крепче, у мага и жреца фонарь дольше.
// Подключается после combat.js.

const CF_DEF = {
  trap: { name: 'Капкан', key: 'KeyN', cd: 20, max: 3, life: 300, arm: 1.5, r: 0.9 },
  stakes: { name: 'Колья', key: 'KeyM', cd: 30, max: 2, life: 180, hp: 4, r: 0.8 },
  lamp: { name: 'Боевой фонарь', key: 'KeyJ', cd: 45, max: 1, life: 50, r: 3.2 },
};
const CF_KEYS = { KeyN: 'trap', KeyM: 'stakes', KeyJ: 'lamp' };
Game.cbfield = [];
const cfList = () => Game.cbfield || (Game.cbfield = []);
const cfCls = h => (h && h.hero && h.hero.clsKey) || '';

function cfSay(h, text) { if (typeof abSay === 'function') abSay(h, text); else floater(h.x, h.y - 1.6, text, '#e8e0c0'); }

function cfPlace(h, k) {
  const H = h && h.hero, D = CF_DEF[k], now = Game.time;
  if (!H || !D || h.dead || h.inside || H.downT || H.hp <= 0 || H.stunUntil > now) return false;
  H.cfCd = H.cfCd || {};
  if (H.cfCd[k] > now) { cfSay(h, `${D.name}: ещё ${Math.ceil(H.cfCd[k] - now)} с`); return false; }
  const free = (x, y) => isWalkable(x, y) && !cfList().some(i => Math.floor(i.x) === x && Math.floor(i.y) === y);
  const fx = Math.floor(h.x + (h.face || 1) * 0.7), fy = Math.floor(h.y + 0.2), hx = Math.floor(h.x), hy = Math.floor(h.y);
  const [tx, ty] = free(fx, fy) ? [fx, fy] : free(hx, hy) ? [hx, hy] : [-1, -1];       // впереди или под ногами
  if (tx < 0) { cfSay(h, 'Здесь не поставить'); return false; }
  const mine = cfList().filter(i => i.k === k && i.ow === h.id);
  if (mine.length >= D.max) cfList().splice(cfList().indexOf(mine[0]), 1);           // самый старый уступает место
  const c = cfCls(h);
  let life = D.life, hp = D.hp || 0, cd = D.cd;
  if (k === 'trap' && (c === 'rogue' || c === 'archer')) cd *= 0.6;
  if (k === 'stakes' && (c === 'warrior' || c === 'barbarian')) hp += 2;
  if (k === 'lamp' && (c === 'mage' || c === 'priest')) life *= 1.5;
  cfList().push({ id: Game.nextId++, k, x: tx + 0.5, y: ty + 0.5, born: now, arm: now + (D.arm || 0), until: now + life, hp, ow: h.id });
  H.cfCd[k] = now + cd;
  fxBurst((tx + 0.5) * TILE, (ty + 0.7) * TILE, 8, ['#d8c8a0', '#a89870'], 40, 25, 0.5, 1.6, 200);
  sfxAt('thud', h.x * TILE, h.y * TILE, 0.5);
  floater(h.x, h.y - 1.8, D.name + '!', '#ffe9a0');
  h.hfx = { k: 'strike', t: now + 0.4 };
  return true;
}

// враг получает n попаданий как от обычного удара героя (скелеты и деревья «держатся»)
function cfHit(f, owner, n) {
  for (let i = 0; i < n && foeAlive(f); i++) killFoe(f, owner);
}
// урон долей здоровья нейтралу (минуя лёгкие удары) и убийство при нуле
function cfHurtNeu(N, owner, part) {
  const d = Math.max(1, N.mhp * part);
  N.hp -= d;
  floater(N.x, N.y - 1.6, '−' + Math.round(d), '#ffd070');
  if (N.hp <= 0 && N.st !== 'die') neuKill(N, owner);
}
function cfFoes(x, y, r) { return foesNear(x, y, r + 1.6).filter(f => Math.hypot(f.o.x - x, f.o.y - y) <= r); }

function cfTick(dt) {
  const list = cfList(), now = Game.time;
  CF.t = (CF.t || 0) + dt;
  if (CF.t < 0.2) return;
  const step = CF.t; CF.t = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i], D = CF_DEF[it.k];
    if (!D || now > it.until) { list.splice(i, 1); continue; }
    const owner = Game.unitMap.get(it.ow), who = owner && !owner.dead ? owner : Game.hero;
    if (!who) continue;
    const fs = cfFoes(it.x, it.y, D.r);
    if (it.k === 'trap') {
      if (now < it.arm || !fs.length) continue;
      const f = fs[0], o = f.o;
      if (f.kind === 'neu') { cfHurtNeu(o, who, 0.18); cbFxSet(o, 'stun', 2, who, 'В капкане!', '#ffe070'); cbFxSet(o, 'open', 3, who, null); neuProvoke(o, who); }
      else { floater(o.x, o.y - 2.2, 'В капкане!', '#ffe070'); o.open = now + 3; cfHit(f, who, 2); }
      fxBurst(it.x * TILE, it.y * TILE - 4, 16, ['#c8ccd0', '#8a909c', '#ffe070'], 80, 40, 0.6, 1.8, 200);
      sfxAt('thud', it.x * TILE, it.y * TILE, 0.9);
      list.splice(i, 1);
    } else if (it.k === 'stakes') {
      it.hit = it.hit || {};
      for (const f of fs) {
        const o = f.o, key = (f.kind === 'neu' ? 'n' : f.kind[0]) + (o.id || fs.indexOf(f));
        if (it.hit[key] > now) continue;
        it.hit[key] = now + 1.5;
        if (f.kind === 'neu') { cfHurtNeu(o, who, 0.06); cbFxSet(o, 'slow', 2.5, who, 'Колья!', '#c8a070'); neuProvoke(o, who); }
        else { floater(o.x, o.y - 2.2, 'Колья!', '#c8a070'); cfHit(f, who, 1); }
        fxBurst(it.x * TILE, it.y * TILE - 6, 8, ['#c8a070', '#8a6a3a'], 50, 30, 0.5, 1.5, 220);
        if (--it.hp <= 0) { floater(it.x, it.y - 1.2, 'Колья сломаны', '#e8e0c0'); list.splice(i, 1); break; }
      }
    } else if (it.k === 'lamp') {
      it.acc = (it.acc || 0) + step;
      if (it.acc < 1) continue;
      it.acc = 0; it.n = (it.n || 0) + 1;
      for (const f of fs) {
        const o = f.o;
        if (f.kind === 'neu') cbFxSet(o, 'slow', 1.5, who, null);
        else if (f.kind === 'skel' && it.n % 4 === 0) { floater(o.x, o.y - 2.2, 'Свет жжёт кости!', '#ffe9a0'); cfHit(f, who, 1); }
        else if (f.kind === 'ent' && o.state === 'walk' && Math.random() < 0.35) { o.state = 'ghosted'; o.t = 0; o.gFrom = [it.x, it.y]; floater(o.x, o.y - 2.2, 'Яркий свет!', '#ffe9a0'); }
      }
    }
  }
}
const CF = { t: 0, hooked: false };

{
  const _step = step;
  step = function (dt) {
    _step(dt);
    if (isMirror()) return;
    if (!CF.hooked && typeof coop !== 'undefined' && coop.players && typeof coopCmd === 'function') {
      CF.hooked = true;
      const _cc = coopCmd;
      coopCmd = function (name, json, admin) {
        let m = null;
        try { m = JSON.parse(json); } catch (e) { return; }
        if (m && m.t === 'deploy') { const u = coop.players.get(name); if (u && !u.dead && CF_DEF[m.k]) cfPlace(u, m.k); return; }
        return _cc(name, json, admin);
      };
      if (typeof coopMirror === 'function') {
        const _cm = coopMirror;
        coopMirror = function () { const m = _cm(); m.cbfield = coopList(Game.cbfield); return m; };
      }
    }
    cfTick(dt);
  };
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.cbfield = []; };
  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser(), now = Game.time;
    if (cfList().length) s.cf = cfList().map(i => ({ k: i.k, x: i.x, y: i.y, rb: Math.round(i.until - now), hp: i.hp, ow: i.ow }));
    return s;
  };
  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    Game.cbfield = [];
    for (const i of s.cf || []) if (CF_DEF[i.k]) Game.cbfield.push({ id: Game.nextId++, k: i.k, x: i.x, y: i.y, born: -99, arm: 0, until: Game.time + i.rb, hp: i.hp || 0, ow: i.ow });
  };
}
// у клиентов общей деревни список приходит зеркалом
if (typeof window !== 'undefined') window.addEventListener('load', () => { if (typeof COOP_LISTS !== 'undefined' && !COOP_LISTS.includes('cbfield')) COOP_LISTS.push('cbfield'); });

// ---------- Рисование ----------
function cfDraw(c, it) {
  const px = Math.round(it.x * TILE), py = Math.round(it.y * TILE + 8), t = Game.time;
  const k = Math.min(1, (t - it.born) / 0.5), fade = Math.min(1, (it.until - t) / 3);
  c.save();
  c.globalAlpha = Math.max(0.2, fade);
  c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(px, py + 1, 9, 3, 0, 0, 7); c.fill();
  if (it.k === 'trap') {
    const armed = t >= it.arm, o = armed ? 4 : 1;
    c.fillStyle = '#1a1008'; c.fillRect(px - 9, py - 3, 18, 5);
    c.fillStyle = '#6a707c'; c.fillRect(px - 8, py - 2, 16, 3);
    c.fillStyle = '#9aa0ac';                                         // зубья двух челюстей
    for (let i = -3; i <= 3; i++) { c.fillRect(px + i * 2.4 - 0.5, py - 2 - o, 1.4, o); c.fillRect(px + i * 2.4, py + 1, 1.2, 1); }
    if (armed) { c.fillStyle = '#c04030'; c.fillRect(px - 1, py - 4, 2, 2); }
    else { c.fillStyle = 'rgba(255,220,120,0.6)'; c.fillRect(px - 8, py - 6, 16 * Math.max(0, Math.min(1, (t - it.born) / Math.max(0.1, it.arm - it.born))), 1.2); }
  } else if (it.k === 'stakes') {
    const hp = it.hp, tilt = [-1.6, 0, 1.6];
    for (let i = 0; i < 3; i++) {
      const x = px - 8 + i * 8, h = 13 * k;
      c.strokeStyle = '#1a1008'; c.lineWidth = 3.2; c.beginPath(); c.moveTo(x, py); c.lineTo(x + tilt[i], py - h); c.stroke();
      c.strokeStyle = hp <= 1 ? '#7a5a3a' : '#a07a4a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, py); c.lineTo(x + tilt[i], py - h); c.stroke();
      c.fillStyle = '#e8d0a0'; c.beginPath(); c.moveTo(x + tilt[i] - 1.6, py - h); c.lineTo(x + tilt[i] + 1.6, py - h); c.lineTo(x + tilt[i], py - h - 4); c.fill();
    }
  } else {
    const fl = 0.8 + 0.2 * Math.sin(t * 9 + it.id);
    c.fillStyle = '#1a1008'; c.fillRect(px - 1.5, py - 16, 3, 16); c.fillRect(px - 5, py - 22, 10, 8);
    c.fillStyle = '#ffb040'; c.fillRect(px - 3.5, py - 20.5, 7, 5);
    c.fillStyle = '#fff2a0'; c.fillRect(px - 1.5, py - 19.5, 3, 3 * fl);
    c.fillStyle = '#4a4452'; c.fillRect(px - 6, py - 23, 12, 2);
    c.globalCompositeOperation = 'lighter';
    const R = CF_DEF.lamp.r * TILE, g = c.createRadialGradient(px, py - 14, 2, px, py - 14, R);
    g.addColorStop(0, `rgba(255,200,100,${0.3 * fl})`); g.addColorStop(1, 'rgba(255,200,100,0)');
    c.fillStyle = g; c.beginPath(); c.arc(px, py - 14, R, 0, 7); c.fill();
  }
  c.restore();
}

{
  const _ds = drawSkeletons;
  drawSkeletons = function (list, c, x0, y0, x1, y1) {
    _ds(list, c, x0, y0, x1, y1);
    for (const it of Game.cbfield || []) {
      if (it.x < x0 - 3 || it.x > x1 + 3 || it.y < y0 - 3 || it.y > y1 + 4) continue;
      list.push([it.y + 0.1, () => cfDraw(c, it)]);
    }
  };
}

// клавиши N, M, J — поставить капкан, колья, фонарь (в общей деревне — просьба серверу)
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('keydown', e => {
    const k = CF_KEYS[e.code];
    if (!k || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const h = Game.hero;
    if (!h || h.dead || !h.hero) return;
    if (typeof Coop !== 'undefined' && Coop.on) { if (typeof coopSend === 'function') coopSend({ t: 'deploy', k }); return; }
    cfPlace(h, k);
  });
}
