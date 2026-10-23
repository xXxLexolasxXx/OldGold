'use strict';
// Голем оживает. До этого он спит каменной статуей. Чтобы разбудить, герой собирает три руны: в лесу, у скал
// (шахта) и у воды. Если завал на пути к Чёрному шпилю слишком велик для гномов, Старец предлагает попросить
// голема — но только с тремя рунами. Ожив, голем идёт по тропе и ломает камни и завалы, но у барьера Малгора
// останавливается: магия его не пускает. Потом бродит по округе, а ночью время от времени давит скелетов.
// Времена года: весной цветёт, летом мох лечит стоящих рядом, осенью сыплет листву, зимой медленнее, но бьёт сильнее.
// Состояние — Game.glq (сохраняется, в коопе живёт на сервере и зеркалится клиентам).

const GL_BARRIER = 11;          // радиус магического барьера вокруг шпиля, клеток
const GL_BIG_BLOCK = 10;        // сколько клеток завала гномы прорубают сами; больше — нужен голем
const GL_RUNE_ORDER = ['forest', 'mine', 'water'];
const GL_RUNE_PLACE = { forest: 'в лесу', mine: 'у скал, где добывают камень', water: 'у воды' };

const glServer = () => typeof coop !== 'undefined' && !!coop && !!coop.out && !!coop.players;
const glMirror = () => typeof isMirror === 'function' && isMirror();
const glHasUI = () => !glServer() && typeof document !== 'undefined' && !!document.getElementById && !!document.getElementById('view') && !window.__SERVER__;
function glSay(text) { if (glServer()) coop.out.push({ msg: { t: 'toast', text } }); else if (typeof toast === 'function') toast(text); }

// ---------- Руны ----------

function glcount(x, y, rad, pred) {
  let n = 0;
  for (let yy = y - rad; yy <= y + rad; yy++) for (let xx = x - rad; xx <= x + rad; xx++) if (inb(xx, yy) && pred(idx(xx, yy))) n++;
  return n;
}
const GL_RUNE_TEST = {
  forest: (x, y, lvl) => glcount(x, y, 3, i => World.obj[i] && World.obj[i].t === 'tree') >= [4, 2, 0][lvl],
  mine: (x, y, lvl) => glcount(x, y, 3, i => World.terrain[i] === T_ROCK) >= [4, 1, 0][lvl],
  water: (x, y, lvl) => glcount(x, y, 2, i => World.terrain[i] === T_WATER) >= [3, 1, 0][lvl],
};
function glRuneSpotOk(x, y) {
  if (!inb(x, y) || !isWalkable(x, y)) return false;
  const i = idx(x, y);
  return !World.obj[i] && !World.door[i] && !World.bmap[i] && !Game.roadSites.has(i);
}
function glPlaceRunes() {
  const [hx, hy] = golemHome(), out = [];
  for (const k of GL_RUNE_ORDER) {
    let best = null;
    for (let lvl = 0; lvl < 3 && !best; lvl++) {
      for (let tries = 0; tries < 1400 && !best; tries++) {
        const r = (lvl === 0 ? 14 : 8) + Math.random() * (lvl === 0 ? 30 : 40), a = Math.random() * Math.PI * 2;
        const x = Math.round(hx + Math.cos(a) * r), y = Math.round(hy + Math.sin(a) * r * 0.8);
        if (!glRuneSpotOk(x, y) || !GL_RUNE_TEST[k](x, y, lvl)) continue;
        if (out.some(o => Math.hypot(o.x - x, o.y - y) < 10)) continue;
        best = { k, x, y, got: 0 };
      }
    }
    if (best) out.push(best);
  }
  return out;
}
function glEnsure() {
  if (Game.glq) return Game.glq;
  return (Game.glq = { runes: glPlaceRunes(), awake: false, known: false, block: false, cleared: false, bar: 0, barX: null, barY: null, rev: 0 });
}
const glGot = () => (Game.glq ? Game.glq.runes.filter(r => r.got).length : 0);
const glAll = () => !!Game.glq && Game.glq.runes.length > 0 && glGot() >= Game.glq.runes.length;

function glRuneTick() {
  const G = Game.glq;
  if (!G || G.runes.every(r => r.got)) return;
  const heroes = Game.units.filter(u => u.type === 'hero' && !u.dead && !u.inside);
  for (const r of G.runes) {
    if (r.got) continue;
    const h = heroes.find(u => Math.hypot(u.x - (r.x + 0.5), u.y - (r.y + 0.5)) < 1.8);
    if (!h) continue;
    r.got = 1; G.rev++;
    const name = GL_RUNE_NAME[r.k];
    floater(r.x + 0.5, r.y - 0.5, 'Руна: ' + name, GL_RUNE_COL[r.k]);
    fxBurst((r.x + 0.5) * TILE, (r.y + 0.5) * TILE - 8, 18, [GL_RUNE_COL[r.k], '#ffffff', '#e4b434'], 70, 60, 1, 2, 120);
    logEvent('tree', `${typeof neuName === 'function' ? neuName(h) : 'Герой'} нашёл ${name} руну (${glGot()} из ${G.runes.length})`, r.x, r.y);
    glSay(glAll() ? 'Найдены все три руны! Теперь есть чем будить голема — поговорите со Старцем' : `Найдена ${name} руна (${glGot()} из ${G.runes.length})`);
    if (glAll()) G.known = true;
  }
}

// ---------- Диалог Старца ----------

function glDirWord(x, y) {
  const [hx, hy] = golemHome(), dx = x - hx, dy = y - hy, d = Math.round(Math.hypot(dx, dy));
  const ns = dy < -d * 0.38 ? 'с' : dy > d * 0.38 ? 'ю' : '', ew = dx > d * 0.38 ? 'в' : dx < -d * 0.38 ? 'з' : '';
  const word = { с: 'севере', ю: 'юге', в: 'востоке', з: 'западе', св: 'северо-востоке', сз: 'северо-западе', юв: 'юго-востоке', юз: 'юго-западе' }[ns + ew] || 'недалеко';
  return `на ${word}, за ${d} шагов от склада`;
}
function glElderText() {
  const G = glEnsure(), n = glGot();
  if (G.awake && G.cleared) return 'Голем сделал, что мог: путь расчищен. Дальше его не пускает барьер Малгора — остальное придётся гномьими руками. Идите с богом, а я пойду с чаем.';
  if (G.awake) return 'Голем уже на ногах и ищет, что бы сломать. Дайте ему время: он вообще-то тяжёлый и неторопливый.';
  if (n >= G.runes.length) return 'Три руны! Вот это я понимаю — не зря бороду растил. Приложите их к груди голема, и он проснётся. Только предупреждаю: к самому Малгору его не пустит барьер, магия там колючая. Зато завал он снесёт как булку.';
  return 'Завал — не гномьего ума дело, тут и десять кирок спеклись бы. Но у нас на холме стоит голем. Спит, как сурок на зимовке. Разбудить его можно тремя рунами: одна лежит в лесу, другая у скал, третья у воды. Герой их найдёт — у героев это получается, пока не просишь счёт.';
}
function glDialogState() {
  const G = glEnsure();
  return { text: glElderText(), runes: G.runes.map(r => ({ k: r.k, got: !!r.got, hint: GL_RUNE_PLACE[r.k] + ', ' + glDirWord(r.x, r.y) })), canWake: glAll() && !G.awake, awake: G.awake };
}

const GlUI = { el: null, open: false, wasPaused: false };
function glStyle() {
  if (document.getElementById('gl-style')) return;
  const st = document.createElement('style'); st.id = 'gl-style';
  st.textContent = `#gl-modal{position:fixed;inset:0;z-index:391;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(6,4,10,.6);overflow-y:auto}
#gl-modal.hidden{display:none}.gl-card{width:min(96vw,560px);max-height:calc(100vh - 24px);overflow-y:auto}
.gl-head{display:flex;gap:12px;align-items:center;margin-bottom:4px}.gl-hd{flex:1;min-width:0}.gl-hd h2{margin:0;text-align:left}
.gl-pt{flex:none;position:relative;display:block;width:72px;height:72px;border:2px solid #f0d070;overflow:hidden;background:radial-gradient(circle at 50% 40%,rgba(255,240,200,.22),rgba(0,0,0,.35) 75%),#1e2a24;box-shadow:inset 0 0 0 1px #0a0705,inset 0 0 0 3px rgba(201,162,74,.35),0 0 10px rgba(0,0,0,.6)}
.gl-pt img{position:absolute;left:0;top:0;width:72px;height:72px;image-rendering:pixelated}.gl-pt .gl-blink{opacity:0;animation:gl-blink 4.6s steps(1) infinite}
@keyframes gl-blink{0%,94%{opacity:0}95%,99%{opacity:1}}@media (prefers-reduced-motion:reduce){.gl-pt .gl-blink{animation:none}}
.gl-who{color:#a8987a;font-size:12px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px}
.gl-text{margin:6px 0 10px;line-height:1.45}.gl-r{display:flex;gap:8px;align-items:center;margin:4px 0;font-size:14px}
.gl-r i{display:inline-block;width:12px;height:12px;border:2px solid #b8902c;transform:rotate(45deg);flex:none}.gl-r.ok i{background:currentColor}
.gl-r.ok{color:#9be08a}.gl-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}`;
  document.head.appendChild(st);
}
function glModalEl() {
  if (GlUI.el) return GlUI.el;
  glStyle();
  const el = document.createElement('div');
  el.id = 'gl-modal'; el.className = 'hidden';
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-gl]');
    if (!b) return;
    if (b.dataset.gl === 'wake') glWakeCmd();
    glHide();
  });
  return (GlUI.el = el);
}
function glHide() {
  if (!GlUI.el) return;
  GlUI.el.classList.add('hidden');
  if (GlUI.open) {
    GlUI.open = false;
    if (!glMirror() && !GlUI.wasPaused && typeof setSpeed === 'function') setSpeed(Game.speed || 1);
  }
}
const glEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// портрет Старца (js/campaign/faces.js); без портрета (сервер, тесты) — только подпись
function glFace() {
  const a = typeof campFaceUrl === 'function' ? campFaceUrl('elder', 0) : '';
  return a ? `<span class="gl-pt"><img src="${a}" alt=""><img class="gl-blink" src="${campFaceUrl('elder', 1)}" alt=""></span>` : '';
}
function glShowElder() {
  if (!glHasUI()) return;
  const G = glEnsure(), D = glDialogState();
  G.known = true;
  const el = glModalEl();
  let h = `<div class="gm-card gl-card"><div class="gl-head">${glFace()}<div class="gl-hd"><div class="gl-who">Старец</div><h2>Каменный сторож</h2></div></div><div class="gl-text">${glEsc(D.text)}</div>`;
  if (!D.awake) for (const r of D.runes) h += `<div class="gl-r${r.got ? ' ok' : ''}" style="color:${r.got ? '#9be08a' : GL_RUNE_COL[r.k]}"><i></i><span>${r.got ? 'Есть' : 'Ищем'}: руна ${glEsc(GL_RUNE_NAME[r.k])} — <span style="color:#d8cfb8">${glEsc(r.hint)}</span></span></div>`;
  h += `<div class="gm-btns">${D.canWake ? '<button class="sm-btn primary" data-gl="wake">Разбудить голема</button>' : ''}<button class="sm-btn" data-gl="close">${D.canWake ? 'Позже' : 'Понял'}</button></div></div>`;
  el.innerHTML = h; el.classList.remove('hidden');
  if (!GlUI.open) {
    GlUI.open = true; GlUI.wasPaused = !!Game.paused;
    if (!glMirror()) Game.paused = true;
  }
}
function glWakeCmd() {
  if (glMirror()) { coopSend({ t: 'glq', a: 'wake' }); return; }
  glWake();
}

// ---------- Пробуждение и работа ----------

function glWake() {
  const G = glEnsure(), g = Game.golem;
  if (G.awake || !glAll() || !g) return false;
  G.awake = true; G.rev++;
  g.state = 'emote'; g.emote = 'wave'; g.dur = 3.2; g.et = 0; g.view = 'S'; g.lastF = -1; g.job = null;
  fxBurst((g.fx + 1.5) * TILE, (g.fy + 1) * TILE - 20, 40, ['#e4b434', '#ffb02e', '#fff2a0', '#b4afa2'], 110, 80, 1.2, 2.4, 140);
  floater(g.fx + 1.5, g.fy - 1.4, 'Гр-р-р-р!', '#ffcf6a');
  logEvent('tree', 'Голем ожил: руны вспыхнули, и камень зашевелился', g.fx + 1.5, g.fy + 1);
  glSay('Голем проснулся! Он сам пойдёт ломать завал на пути к шпилю');
  g.wakeT = Game.time + 3.4; g.tried = 0;
  return true;
}

function glCentre() { const F = Game.foe; return F ? [F.tx + 1.5, F.ty - 1] : null; }

// клетки пути гномов к шпилю; null — пути нет
function glRoutePath(sx, sy) {
  const F = Game.foe;
  if (!F) return null;
  const h = spireNearWalk(...spireFront(F));
  if (!h) return null;
  const st = spireNearWalk(sx, sy) || [sx, sy];
  const cells = spireCarvePath(st[0], st[1], h[0], h[1]);
  return cells;
}
function glBlockedCount(cells) { let n = 0; for (const i of cells) if (!walkIdx(i)) n++; return n; }

// вернуть гномам право рубить самим, если завал небольшой; иначе — отказ, пусть вмешивается Старец
{
  const _er = spireEnsureRoute;
  spireEnsureRoute = function (sx, sy) {
    const G = Game.glq, F = Game.foe;
    if (G && F && !G.cleared) {
      const st = spireNearWalk(sx, sy) || [sx, sy], h = spireNearWalk(...spireFront(F));
      if (h && !findPath(st[0], st[1], h[0], h[1])) {
        const cells = spireCarvePath(st[0], st[1], h[0], h[1]);
        if (cells && glBlockedCount(cells) > GL_BIG_BLOCK) {
          if (!G.block) { G.block = true; G.rev++; }
          return { ok: false, big: true, why: 'завал на тропе слишком велик для кирок — Старец подскажет, как быть' };
        }
      }
    }
    const r = _er(sx, sy);
    if (G && r.ok && G.block) { G.block = false; G.rev++; }
    return r;
  };
}

const GL_JOB_SPEED = 1.5;
function glFace(g, dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) { g.view = 'E'; if (dx) g.face = dx > 0 ? 1 : -1; } else g.view = dy < 0 ? 'N' : 'S';
}
function glStompDust(g, hit, n = 7) {
  for (let k = 0; k < n; k++) g.dust.push({ x: (g.fx + 1.5) * TILE + (hit ? -14 : 14) + (Math.random() - 0.5) * 24, y: (g.fy + 2) * TILE - 10, vx: (Math.random() - 0.5) * 18, vy: -5 - Math.random() * 7, a: 0.7, r: 3 + Math.random() * 3 });
}

// клетки, которые голем крушит: скалы и завалы (стены игрока и здания не трогает)
function glCarve(cells) {
  let rock = 0;
  const gone = [];
  for (const i of cells) {
    if (walkIdx(i) || !spireCarvable(i)) continue;
    if (World.terrain[i] === T_ROCK) {
      World.terrain[i] = T_GRASS; World.crystal[i] = 0; rock++; gone.push(i);
      if (typeof ROCKMINE !== 'undefined') ROCKMINE.mined.add(i);
    }
    const o = World.obj[i];
    if (o) { World.obj[i] = null; World.growing.delete(i); }
  }
  if (rock && typeof buildMountains === 'function') buildMountains(Game.seed);
  PF.regT = -1e9;
  if (gone.length && typeof spireCvNote === 'function') spireCvNote(gone);
  return gone.length;
}

function glStartSmash(g) {
  const G = Game.glq, v = Game.hero && !Game.hero.dead ? [Math.floor(Game.hero.x), Math.floor(Game.hero.y)] : spireVillage();
  const cells = glRoutePath(v[0], v[1]) || glRoutePath(...spireVillage());
  if (!cells || !cells.length) { glSay('Голем потоптался и развёл руками: дальше вода или стены, ломать нечего'); G.cleared = true; return false; }
  const C = glCentre(), path = [];
  let hit = false;
  for (const i of cells) {
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    if (Math.hypot(x - C[0], y - C[1]) < GL_BARRIER) { hit = true; G.barX = x; G.barY = y; break; }
    path.push([x, y]);
  }
  g.job = { kind: 'smash', path, i: 0, barrier: hit, stomp: 0 };
  g.state = 'walk';
  return true;
}

function glHuntTarget(g) {
  const sk = Game.skels;
  if (!sk || !sk.length) return null;
  const cx = g.fx + 1.5, cy = g.fy + 1;
  let best = null, bd = 48;
  for (const s of sk) {
    if (s.state !== 'roam' && s.state !== 'fight') continue;
    const d = Math.hypot(s.x - cx, s.y - cy);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function glStartHunt(g) {
  const s = glHuntTarget(g);
  if (!s) return false;
  const sx = Math.round(g.fx + 1), sy = Math.round(g.fy + 1);
  const p = findPath(sx, sy, Math.floor(s.x), Math.floor(s.y), false, 0, 3000, 1);
  if (!p || !p.length) return false;
  const path = p.slice(0, Math.max(0, p.length - 3)).map(c => [c[0], c[1]]);   // не заходит вплотную
  g.job = { kind: 'hunt', path, i: 0, stomp: 0, target: s };
  g.state = 'walk';
  return true;
}
// удар: скелеты вокруг рассыпаются, зимой удар шире и сильнее
function glSmashUndead(g) {
  const cx = g.fx + 1.5, cy = g.fy + 1.2, rad = golemSea() === 2 ? 6.5 : 4.5;
  let n = 0;
  for (const s of Game.skels || []) {
    if (s.state === 'dead' || s.state === 'sink' || s.state === 'rise') continue;
    if (Math.hypot(s.x - cx, s.y - cy) > rad) continue;
    s.state = 'dead'; s.t = 0; s.moving = false; n++;
    sfxAt('rattle', s.x * TILE, s.y * TILE, 1.2);
    fxBurst(s.x * TILE, s.y * TILE - 10, 24, ['#e6dfc8', '#c8c0a4', '#8a6a3a', '#5a6a4a'], 80, 50, 1.2, 2.2, 260);
    floater(s.x, s.y - 1.6, 'Хрясь!', '#e8e8d0');
  }
  if (n) { glStompDust(g, true, 10); logEvent('tree', `Голем раздавил ${n > 1 ? 'скелетов: ' + n : 'скелета'}`, g.fx + 1.5, g.fy + 1); sfxAt('thud', cx * TILE, cy * TILE, 1.4); }
  return n;
}

function glJobTick(g, dt) {
  const j = g.job, G = Game.glq;
  g.t += dt;
  if (j.stomp > 0) {                                   // топчет: удар в 55 % анимации
    g.state = 'emote'; g.emote = 'stomp'; g.dur = 2.4; g.et = 2.4 - j.stomp;
    const fr = Math.floor(g.et / g.dur * 12);
    if (fr >= 5 && !j.hit1) { j.hit1 = 1; glStompDust(g, true); sfxAt('thud', (g.fx + 1.5) * TILE, (g.fy + 1) * TILE, 1.5); if (j.kind === 'smash') glSmashStep(g, j); else glSmashUndead(g); }
    if (fr >= 11 && !j.hit2) { j.hit2 = 1; glStompDust(g, false); sfxAt('thud', (g.fx + 1.5) * TILE, (g.fy + 1) * TILE, 1.5); if (j.kind === 'hunt') glSmashUndead(g); }
    j.stomp -= dt;
    if (j.stomp <= 0) { j.stomp = 0; j.hit1 = j.hit2 = 0; g.state = 'walk'; if (j.kind === 'hunt') { g.job = null; g.state = 'idle'; g.timer = 3; g.emote = null; g.fx = Math.round(g.fx); g.fy = Math.round(g.fy); } }
    return;
  }
  const next = j.path[j.i];
  if (!next) { glJobEnd(g, j); return; }
  if (j.kind === 'smash' && j.pending == null && !walkIdx(idx(next[0], next[1]))) { j.pending = j.i; j.stomp = 2.4; j.hit1 = j.hit2 = 0; return; }
  const tx = next[0] - 1, ty = next[1] - 1, dx = tx - g.fx, dy = ty - g.fy, d = Math.hypot(dx, dy);
  const stepD = Math.min(d, GL_JOB_SPEED * golemSpeedMul() * dt);
  g.state = 'walk';
  if (d > 1e-3) {
    glFace(g, dx, dy);
    g.fx += dx / d * stepD; g.fy += dy / d * stepD; g.ph += stepD / 1.7;
    const fr = Math.floor(g.ph * 8) & 7;
    if ((fr === 0 || fr === 4) && fr !== g.lastF) for (let k = 0; k < 4; k++) g.dust.push({ x: (g.fx + 1.5) * TILE + (fr ? 14 : -14) + (Math.random() - 0.5) * 16, y: (g.fy + 2) * TILE - 10, vx: (Math.random() - 0.5) * 8, vy: -4 - Math.random() * 5, a: 0.55, r: 2.4 + Math.random() * 2 });
    g.lastF = fr;
  }
  if (d - stepD < 1e-3) {
    j.pending = null; j.i++;
    // на охоте — остановиться, как только скелет рядом
    if (j.kind === 'hunt' && (j.i >= j.path.length || Math.hypot(j.target.x - (g.fx + 1.5), j.target.y - (g.fy + 1)) < 4)) { j.stomp = 2.4; j.hit1 = j.hit2 = 0; }
  }
}
// удар по завалу: ломаем до трёх клеток подряд
function glSmashStep(g, j) {
  const cells = [];
  for (let k = j.pending; k < Math.min(j.path.length, j.pending + 3); k++) cells.push(idx(j.path[k][0], j.path[k][1]));
  const n = glCarve(cells);
  if (n) { fxBurst((g.fx + 1.5) * TILE, (g.fy + 1) * TILE, 22, ['#8a8579', '#5e5951', '#b4afa2', '#3e3a33'], 90, 70, 1, 2.4, 260); floater(g.fx + 1.5, g.fy - 1.2, 'Хрясь!', '#e8e8d0'); }
}
function glJobEnd(g, j) {
  const G = Game.glq;
  if (j.kind === 'smash') {
    if (j.barrier) {                                   // упёрся в барьер
      G.bar = Game.time; G.rev++;
      sfxAt('wail', G.barX * TILE, G.barY * TILE, 1.4);
      floater(g.fx + 1.5, g.fy - 1.6, 'Барьер не пускает!', '#d8a8ff');
      logEvent('night', 'Голема остановил магический барьер Малгора: дальше пойдут гномы', g.fx + 1.5, g.fy + 1);
      glSay('Голем упёрся в барьер Малгора и не пошёл дальше. Тропа расчищена — оставшееся прорубят гномы');
    } else glSay('Голем расчистил тропу');
    G.cleared = true; G.block = false; G.rev++;
    Game.spireWhy = ''; if (typeof Spire !== 'undefined') Spire.pathT = -99;
    // отступает от барьера на пару клеток
    const last = j.path[j.path.length - 1];
    if (last && j.barrier) { const back = j.path.slice(-4).reverse(); g.job = { kind: 'retreat', path: back, i: 0, stomp: 0 }; return; }
  }
  g.job = null; g.state = 'idle'; g.timer = 4 + Math.random() * 4; g.fx = Math.round(g.fx); g.fy = Math.round(g.fy);
  if (!golemFree(g.fx, g.fy)) g.stuck = 0.1;
}

// лето: мох лечит рядом стоящих; зимой и осенью — нет
function glHealTick(g) {
  if (golemSea() !== 0) return;
  const cx = g.fx + 1.5, cy = g.fy + 1;
  for (const u of Game.units) {
    if (u.dead || u.inside || Math.hypot(u.x - cx, u.y - cy) > 5) continue;
    if (u.hero && u.hero.hp != null && u.hero.maxhp && u.hero.hp < u.hero.maxhp) { u.hero.hp = Math.min(u.hero.maxhp, u.hero.hp + u.hero.maxhp * 0.02); continue; }
    if (typeof injCanTreat === 'function' && injCanTreat(u)) { injHeal(u, 'moss'); return; }
    if (u.ill && typeof sickCure === 'function') { u.ill.s = Math.max(0, (u.ill.s || 0) - 0.1); if (u.ill.s <= 0.02) { sickCure(u, 'moss'); return; } }
  }
}

// ---------- Тик ----------

{
  const _tick = golemTick;
  golemTick = function (dt) {
    const g = Game.golem, G = Game.glq;
    if (!g) return;
    if (glMirror()) { if (G && G.awake) _tick(dt); return; }
    if (!G) { glEnsure(); return; }
    G.t = (G.t || 0) + dt;
    if (G.t - (G.rt || 0) > 0.5) { G.rt = G.t; glRuneTick(); }
    if (!G.awake) {                                    // спит: стоит на месте; если на нём построили — переезжает
      g.state = 'idle'; g.t += dt;
      if (!golemFree(Math.round(g.fx), Math.round(g.fy))) { g.stuck += dt; if (g.stuck > 10) { spawnGolem(); } }
      return;
    }
    golemLookSync();
    if (g.wakeT && Game.time < g.wakeT) { g.et += dt; g.t += dt; return; }      // потягивается после сна
    if (g.wakeT) { g.wakeT = 0; g.state = 'idle'; g.emote = null; g.timer = 1; }
    if (!G.cleared && !g.job && !g.tried && Game.foe && !Game.foe.defeated) { g.tried = 1; if (glStartSmash(g)) return; }
    if (g.job) {
      glJobTick(g, dt);
      for (const p of g.dust) { p.x += p.vx * dt; p.y += p.vy * dt; p.a -= dt * 0.55; p.r += dt * 2.2; }
      g.dust = g.dust.filter(p => p.a > 0);
      return;
    }
    G.ht = (G.ht || 0) + dt;
    if (G.ht > 3) { G.ht = 0; glHealTick(g); }
    // ночью время от времени идёт давить скелетов (раз в 25–45 секунд)
    if (g.state === 'idle' && (isNightNow() || isEveningNow())) {
      G.hunt = (G.hunt == null ? 20 : G.hunt) - dt;
      if (G.hunt <= 0) { G.hunt = 25 + Math.random() * 20; if (glStartHunt(g)) return; }
    }
    _tick(dt);
  };
}

// ---------- Диалог по ходу «Выступить» ----------

{
  const _go = spireGo;
  spireGo = function () {
    _go();
    const G = Game.glq;
    if (!G) return;
    if (glMirror() ? G.block : G.block && !G.cleared) glShowElder();
  };
}

// ---------- Подключение: сброс, сейв, кооп ----------

{
  const _reset = resetGameState;
  resetGameState = function () { _reset(); Game.glq = null; glHide(); };

  const _setup = setupStart;
  setupStart = function (seed, ...o) { _setup(seed, ...o); Game.glq = null; glEnsure(); };

  const _ser = serializeGame;
  serializeGame = function () {
    const s = _ser();
    if (Game.glq) s.glq = JSON.parse(JSON.stringify(Game.glq));
    return s;
  };

  const _apply = applySave;
  applySave = function (s) {
    _apply(s);
    Game.glq = s.glq && Array.isArray(s.glq.runes) ? JSON.parse(JSON.stringify(s.glq)) : null;
    glEnsure();
  };
}
