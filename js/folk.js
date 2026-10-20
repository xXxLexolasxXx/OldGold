'use strict';
// Гномки и гномята — поверх family.js (пол u.fam.sx, возраст u.fam.a, тип kid) и kidsplay.js (детские забавы).
// Облик — people.js (lookOf: без бороды, нос-кнопочка, косы, платки, чепцы; гномята — шапочка с помпоном, голова крупнее).
// Гномки: не курят, пьют втрое реже (и хмелеют втрое реже), на поле (вспашка, жатва, хмель) работают на 20 % быстрее,
//   у печи (пекарь, мясник) — на 15 %, рядом с больным выхаживают его (хворь сходит быстрее); с нечистью не дерутся — бегут.
// Гномята: не курят, не пьют, оружия не носят и не дерутся; ловят куриц понарошку (обнимут и отпустят — без тушки
//   и без куриной мести), гоняют гусей и волков, бегают в школу, догонялками изредка (4 %, раз в 2 минуты) спугивают
//   мелкую нечисть. Утащить гномёнка нечисть не может: когда призрак, скелет, летучая мышь или сова пытаются его
//   схватить, гномёнок выхватывает игрушечный пистолет — «Бах!» — и нечисть удирает (журнал, летопись, ачивка «Бах!»).
//   От крупных (энты, водяной, каменный, боссы) гномёнок прячется.
// Кадры «Бах!»: выхват 4 (0,4 с), прицел, вспышка с облачком 6 (0,6 с), гордая стойка. Рисует folkDrawBah поверх гнома.
// Сейв: пол и возраст — в s.units[k].fam (family.js); счётчики — s.folk; сейв без семей — все взрослые мужчины.
// Кооп: считает сервер; u.bah идёт в пакете жителей (COOP_UNIT_EX), нечисть зеркалится как обычно.

const FOLK = {
  BEER: 1 / 3,        // гномка пьёт и хмелеет втрое реже
  FIELD: 1.2,         // скорость на поле
  COOK: 1.15,         // скорость у печи
  CARE: 0.6,          // доля обычного выздоровления, которую добавляет уход гномки рядом
  CARE_R: 2.5,
  TAG_P: 0.04,        // шанс за проверку (раз в секунду), что догонялки спугнут нечисть рядом
  TAG_CD: 120,
  TAG_R: 3.5,
  BAH_TRY: { ghost: 0.15, bat: 0.1, skel: 0.35 },   // как часто нечисть «пробует» схватить гномёнка, которого увидела
  FUN_P: 0.2,         // шанс, что свободный гномёнок займётся «взрослым» делом: гуси, волки, школа
};
const FOLK_FIELD = new Set(['reap', 'dig', 'hoppick']);
const FOLK_FIELD_T = new Set(['farmer', 'hopgrower']);
const FOLK_COOK_T = new Set(['baker', 'butcher']);
const BAH_NAME = { ghost: 'призрак', skel: 'скелет', bat: 'летучая мышь', owl: 'сова' };
const BAH_RUN = {
  ghost: ['Ай-ай-ай!', 'Не стреляй!', 'Я пошутил!', 'Мама-а!'],
  skel: ['Клац-клац! Ухожу!', 'Мои кости!', 'Нечестно!'],
  bat: ['Пи-и-и!', 'Ой-ой!'],
  owl: ['Уху?!', 'Ухожу-ху!'],
};
const BAH_KID = ['Бах! И нету!', 'Так тебе!', 'Ещё придёшь?', 'Я не боюсь!'];

const folkMirror = () => typeof famMirror === 'function' && famMirror();
const folkKid = u => !!u && u.type === 'kid';
const folkFem = u => !!u && u.type !== 'kid' && !u.hero && personSex(u) === 'f';
// с нечистью не дерутся: гномята и гномки (героиня и рекруты-воительницы — дерутся)
const folkNoFight = u => folkKid(u) || (folkFem(u) && !u.rec && !u.gm && u.type !== 'hero');
function folkBeerK(u) { return folkFem(u) ? FOLK.BEER : 1; }
function folkG() { return Game.folk || (Game.folk = { st: { bah: 0, tag: 0, hen: 0, shoo: 0, lesson: 0, care: 0 } }); }
const folkPick = a => a[(Math.random() * a.length) | 0];
const folkName = u => (u.fam && u.fam.n) || UNIT_TYPES[u.type].name;

Object.assign(SFX, {
  // игрушечный пистолет: щелчок пробки и тихий хлопок
  toyPop: (d, t) => { noiseHit(d, 'bandpass', 2600, 1400, 1.6, t, 0.035, 0.32, 0.001); tone(d, 'square', 980, 360, t, 0.045, 0.14, 0.001); tone(d, 'sine', 620, 300, t + 0.05, 0.09, 0.16, 0.002); },
  // нечисть удирает: «пуф» тумана
  bahPuff: (d, t) => { noiseHit(d, 'lowpass', 900, 260, 0.8, t, 0.28, 0.22, 0.02); tone(d, 'sine', 420, 140, t, 0.3, 0.1, 0.02); },
});
Object.assign(SFX_DEF, {
  toyPop: { pri: 1, gain: 0.4, poly: 2, cd: 0.15, len: 0.2 },
  bahPuff: { pri: 0, gain: 0.3, poly: 2, cd: 0.2, len: 0.35 },
});

// ---------- Пол новых жителей ----------
// Пол и имя даются сразу при появлении: иначе первые секунды все ходили бы бородачами, а потом половина «переодевалась».
if (typeof spawnUnit === 'function') {
  const _sp = spawnUnit;
  spawnUnit = function (type, x, y) {
    const u = _sp(type, x, y);
    if (u && !u.fam && !folkMirror() && typeof famOn === 'function' && famOn(u)) { famOf(u); if (folkFem(u) || folkKid(u)) u.smoker = false; }
    return u;
  };
}

// житель из сейва до семей — взрослый мужчина
if (typeof famOf === 'function') {
  const _fo = famOf;
  famOf = function (u) {
    if (u.fam || !u.folkOld) return _fo(u);
    const f = _fo(u);
    u.folkOld = false;
    if (f.sx === 'f') { f.sx = 'm'; f.n = famPick(FAM_M); u.cname = f.n; }
    if (f.a < FAM_ADULT) f.a = FAM_ADULT + 2;
    return f;
  };
}

// ---------- Работа: поле, печь ----------
if (typeof Unit !== 'undefined') {
  const _sa = Unit.prototype.stepAction;
  Unit.prototype.stepAction = function (dt) {
    const a = this.action;
    if (a && a.wait !== undefined && !a.walk && folkFem(this)) {
      if (FOLK_FIELD.has(this.anim) && FOLK_FIELD_T.has(this.type)) dt *= FOLK.FIELD;
      else if (this.inside && FOLK_COOK_T.has(this.type)) dt *= FOLK.COOK;
    }
    return _sa.call(this, dt);
  };
}

// ---------- Уход за больными ----------
if (typeof sickCheck === 'function') {
  const _sc = sickCheck;
  sickCheck = function (u, now, units) {
    _sc(u, now, units);
    const I = u.ill, K = I && SICK_KINDS[I.k];
    if (!K || u.dead || I.s <= 0) return;
    let nurse = null;
    for (const o of units) {
      if (o === u || o.dead || o.ill || !folkFem(o)) continue;
      if (u.inside ? o.inside !== u.inside : (o.inside || Math.abs(o.x - u.x) > FOLK.CARE_R || Math.abs(o.y - u.y) > FOLK.CARE_R)) continue;
      nurse = o; break;
    }
    if (!nurse) return;
    I.s = Math.round(Math.max(0, I.s - K.heal * FOLK.CARE) * 1000) / 1000;
    folkG().st.care++;
    if (!nurse.inside && Math.random() < 0.08 && typeof floater === 'function') floater(nurse.x, nurse.y - 1.3, folkPick(['Держись, родной!', 'Выпей отвару.', 'Укрою потеплее.']), '#e8f0d0');
    if (I.s <= 0) sickCure(u, 'self');
  };
}

// ---------- «Бах!» ----------

// координаты нечисти в клетках (сова живёт в пикселях мира)
const bahXY = (m, kind) => kind === 'owl' ? [m.x / TILE, m.y / TILE] : [m.x, m.y];

// нечисть пугается и удирает
function folkScare(m, kind, u) {
  const [mx, my] = bahXY(m, kind);
  const dx = mx - u.x, dy = my - u.y, d = Math.hypot(dx, dy) || 1;
  m.bahCD = Game.time + 60;
  floater(mx, my - (kind === 'skel' ? 2 : 1.8), folkPick(BAH_RUN[kind]), '#dcecff');
  if (kind === 'ghost') { m.mode = 'leave'; m.modeT = 99; m.atkT = 0; m.bahFlee = { dx: dx / d, dy: dy / d, until: Game.time + 3 }; m.grabCD = Game.time + 300; }
  else if (kind === 'bat') { m.leave = true; m.grabCD = Game.time + 300; }
  else if (kind === 'skel') { m.state = 'sink'; m.t = 0; m.moving = false; m.fighters = []; }
  else if (kind === 'owl') m.grabCD = Game.time + 300;
  if (typeof fxLater === 'function') fxLater(0.5, () => {
    const [x, y] = bahXY(m, kind);
    if (typeof fxBurst === 'function') fxBurst(x * TILE, y * TILE - 12, 12, ['#eef6ff', '#cfe0f0', '#a8b8c8'], 40, 26, 0.8, 2.2, -40);
    floater(x, y - 2.2, 'Пуф!', '#ffffff');
    sfxAt('bahPuff', x * TILE, y * TILE, 1);
  });
}

// гномёнок достаёт игрушечный пистолет
function folkBah(u, m, kind) {
  if (!u || u.dead || (u.bahAt || 0) > Game.time || (m.bahCD || 0) > Game.time) return false;
  u.bahAt = Game.time + 8; m.bahCD = Game.time + 8;
  if (u.carry) dropLoad(u);
  startBreak(u, 'bah', null);
  u.proc = folkBahGen(u, m, kind);
  return true;
}

function* folkBahGen(u, m, kind) {
  const [mx] = bahXY(m, kind);
  const f = mx >= u.x ? 1 : -1;
  u.face = f; u.vdir = 'E';
  u.bah = { t: Game.time, f, k: kind };
  u.gest = 'point'; u.gestUntil = Game.time + 1.7; u.gestFace = f;
  floater(u.x, u.y - 1.1, folkPick(['Не подходи!', 'Стой, кто идёт!', 'Руки вверх!']), '#fff2a0');
  if (kind === 'ghost' && m.mode === 'drift') { m.mode = 'boo'; m.modeT = 1; }   // призрак тянется к гномёнку
  yield { wait: 0.7 };                                                            // выхватил (4 кадра) и прицелился
  if (u.dead) return;
  u.bah.s = Game.time;                                                            // выстрел: вспышка и облачко (6 кадров)
  sfxUnit(u, 'toyPop');
  if (typeof fxBurst === 'function') fxBurst(u.x * TILE + f * 6, u.y * TILE - 2, 6, ['#fff6a0', '#ffd040', '#ffffff'], 30, 14, 0.35, 1.2, 0);
  folkScare(m, kind, u);
  const G = folkG(); G.st.bah++;
  const name = folkName(u), who = BAH_NAME[kind];
  const text = `${u.fam && u.fam.sx === 'f' ? 'Гномочка' : 'Гномёнок'} ${name} пальнул из игрушечного пистолета: ${who} удрал${kind === 'bat' || kind === 'owl' ? 'а' : ''}`;
  logEvent('night', text, u.x, u.y);
  if (typeof chronAdd === 'function') chronAdd('night', `${typeof chronWhen === 'function' ? chronWhen() + ' ' : ''}${text.charAt(0).toLowerCase() + text.slice(1)}. Бах!`, 1);
  if (G.st.bah === 1 || Game.time - (G.toastAt || -99) > 60) { G.toastAt = Game.time; toast(`«Бах!» — ${text.toLowerCase()}`); }
  yield { wait: 0.9 };
  u.gest = 'fist'; u.gestUntil = Game.time + 1.6; u.gestFace = f;                // гордо стоит
  floater(u.x, u.y - 1.3, folkPick(BAH_KID), '#fff2a0');
  yield { wait: 1.6 };
  u.bah = null;
}

// призрак удирает с ускорением, мерцая
if (typeof ghostsTick === 'function') {
  const _gt = ghostsTick;
  ghostsTick = function (dt) {
    for (const g of Game.ghosts || []) {
      const F = g.bahFlee;
      if (!F) continue;
      if (Game.time > F.until) { g.bahFlee = null; continue; }
      const sp = 2.2 + (3 - (F.until - Game.time)) * 1.6;
      g.x += F.dx * sp * dt; g.y += F.dy * sp * dt - 0.3 * dt; g.face = F.dx >= 0 ? 1 : -1;
    }
    _gt(dt);
  };
}

// попытки утащить гномёнка оборачиваются выстрелом
function folkTry(kind, m, u) {
  if (!folkKid(u) || u.inside || !interruptible(u) || (m.bahCD || 0) > Game.time) return false;
  return Math.random() < (FOLK.BAH_TRY[kind] || 0) && folkBah(u, m, kind);
}
if (typeof ghCanTake === 'function') {
  const _g = ghCanTake;
  ghCanTake = function (g, u) {
    if (!folkKid(u)) return _g(g, u);
    if (g.kind !== 'reaper') { if (_g(g, u)) folkBah(u, g, 'ghost'); else folkTry('ghost', g, u); }
    return false;
  };
}
if (typeof batCanTake === 'function') {
  const _b = batCanTake;
  batCanTake = function (b, u) {
    if (!folkKid(u)) return _b(b, u);
    if (!b.leave && b.state !== 'grab') { if (_b(b, u)) folkBah(u, b, 'bat'); else folkTry('bat', b, u); }
    return false;
  };
}
if (typeof owlCanTake === 'function') {
  const _o = owlCanTake;
  owlCanTake = function (o, dt) {
    const p = _o(o, dt);
    if (p && p.u && folkKid(p.u)) { folkBah(p.u, o, 'owl'); return null; }
    return p;
  };
}
// скелет: гномёнок не дерётся, а стреляет; гномка не дерётся, а бежит
if (typeof skelReact === 'function') {
  const _sr = skelReact;
  skelReact = function (s, u) {
    if (!folkNoFight(u)) return _sr(s, u);
    s.seen.add(u.id);
    if (u.brk && u.brk.kind === 'lost') endBreak(u);
    floater(u.x, u.y - 1, 'Скелет!', '#e8e8d0');
    if (folkKid(u) && Math.random() < FOLK.BAH_TRY.skel && folkBah(u, s, 'skel')) return;
    if (!folkKid(u) && Math.random() < 0.2) { startBreak(u, 'freeze', null); u.proc = freezeGen(u); return; }
    startBreak(u, 'flee', null); u.proc = fleeGen(u);
  };
}
// энты, водяной, каменный — крупные: гномёнок прячется, гномка бежит
function folkHide(u) {
  if (folkKid(u)) floater(u.x, u.y - 1, folkPick(['Прячусь!', 'Мама!', 'Я в домике!']), '#ffe0e0');
  startBreak(u, 'flee', null); u.proc = fleeGen(u);
}
// на всякий случай: крупная нечисть гномёнка тоже не уносит
if (typeof entTakes === 'function') {
  const _et = entTakes;
  entTakes = function (e, u) { if (folkKid(u)) { e.state = 'walk'; e.fighters = []; folkHide(u); return; } _et(e, u); };
}

// ---------- Гномята: забавы ----------

// курицу — понарошку: поймал, обнял, отпустил
if (typeof chickenGen === 'function') {
  const _cg = chickenGen;
  chickenGen = function* (u, hen) {
    if (!folkKid(u)) { yield* _cg(u, hen); return; }
    for (let k = 0; k < 5 && !hen.dead; k++) {
      u.gest = 'wave'; u.gestUntil = Game.time + 3;
      yield { walk: [Math.floor(hen.x), Math.floor(hen.y)], offroad: true };
      if (Math.random() < 0.3) floater(hen.x, hen.y - 0.8, 'Ко-ко!', '#ffffff');
      if (!hen.dead && Math.hypot(hen.x - u.x, hen.y - u.y) < 1.4 && Math.random() < 0.35) {
        hen.calm = Game.time + 2.4;
        floater(u.x, u.y - 1.2, 'Поймал!', '#fff2a0');
        sfxUnit(u, 'cluck');
        u.gest = 'clap'; u.gestUntil = Game.time + 1.6;
        yield { wait: 1.8 };
        floater(u.x, u.y - 1.2, folkPick(['Беги, Пеструшка!', 'Отпускаю!', 'Ты моя хорошая']), '#fff2a0');
        folkG().st.hen++;
        yield { wait: 0.8 };
        return;
      }
    }
    u.gest = 'scratch'; u.gestUntil = Game.time + 1.6;
    yield { wait: 1.4 };
  };
}

function* folkKidFun(u) {
  const day = !isNightNow();
  const goose = day && typeof nearestAnimal === 'function' ? nearestAnimal(u.x, u.y, 10, a => a.kind === 'goose' && !a.loot && a.state !== 'shoo') : null;
  const wolf = day && typeof nearestAnimal === 'function' ? nearestAnimal(u.x, u.y, 9, a => (a.kind === 'wolf' || a.kind === 'fox') && a.state !== 'flee' && !a.owner) : null;
  const school = day ? Game.buildings.find(b => b.type === 'school' && b.state === 'done' && !b.removed) : null;
  const opts = [];
  if (goose) opts.push('goose', 'goose');
  if (wolf) opts.push('wolf');
  if (school) opts.push('school', 'school');
  if (!opts.length) return false;
  const what = folkPick(opts);
  if (what === 'goose' || what === 'wolf') {
    const a = what === 'goose' ? goose : wolf;
    floater(u.x, u.y - 1.1, what === 'goose' ? 'Кыш, гуси!' : 'Пошёл вон, серый!', '#fff2a0');
    for (let k = 0; k < 3 && !a.dead; k++) {
      u.gest = 'fist'; u.gestUntil = Game.time + 2;
      yield { walk: [Math.floor(a.x), Math.floor(a.y)], offroad: true };
      if (a.dead || Math.hypot(a.x - u.x, a.y - u.y) > 2.6) continue;
      if (what === 'goose') gooseShoo(a, { hero: null, who: [u], x: u.x, y: u.y });   // прогон гусей ждёт «отряд»
      else {
        a.state = 'flee'; a.target = null; a.fleeBoost = Game.time + 3; a.stealCD = Math.max(a.stealCD || 0, Game.time + 60);
        const s = (typeof wildSpot === 'function' && wildSpot(18)) || a.home;
        animalGo(a, s[0], s[1]); a.home = s;
        floater(a.x, a.y - 1, 'Ай-ай!', '#ffffff');
      }
      folkG().st.shoo++;
      u.gest = 'clap'; u.gestUntil = Game.time + 1.4;
      yield { wait: 1.4 };
      return true;
    }
    return true;
  }
  // в школу: посидеть на уроке
  const ok = yield { walk: [school.doorX, school.doorY] };
  if (!ok || school.removed) return true;
  yield { enter: school };
  yield { wait: 8 + Math.random() * 5 };
  yield { leave: true };
  folkG().st.lesson++;
  if (u.fam) u.fam.ls = (u.fam.ls || 0) + 1;
  floater(u.x, u.y - 1.2, folkPick(['Дважды два — четыре!', 'А я букву «Г» знаю!', 'Гном — с большой буквы!', 'Задали на дом…']), '#e8f0ff');
  return true;
}
if (typeof kidGen === 'function') {
  const _kg = kidGen;
  kidGen = function* (u) {
    if (!folkMirror() && Math.random() < FOLK.FUN_P && (yield* folkKidFun(u))) { yield { wait: 1 + Math.random() * 2 }; return; }
    yield* _kg(u);
  };
}

// догонялки: гномята, носясь по деревне ночью, иногда спугивают мелкую нечисть
function folkTagTick() {
  const night = (typeof nightAmt === 'function' ? nightAmt() : 0) > 0.3;
  if (!night) return;
  for (const u of Game.units) {
    if (!folkKid(u) || u.dead || u.inside || u.brk || (u.tagAt || 0) > Game.time || !interruptible(u)) continue;
    let m = null, kind = '';
    for (const g of Game.ghosts || []) if (g.kind !== 'reaper' && g.mode !== 'leave' && g.mode !== 'grab' && g.alpha > 0.3 && Math.hypot(g.x - u.x, g.y - u.y) < FOLK.TAG_R) { m = g; kind = 'ghost'; break; }
    if (!m) for (const b of Game.bats || []) if (!b.leave && b.state !== 'grab' && Math.hypot(b.x - u.x, b.y - u.y) < FOLK.TAG_R) { m = b; kind = 'bat'; break; }
    if (!m) for (const s of Game.skels || []) if (s.state === 'roam' && Math.hypot(s.x - u.x, s.y - u.y) < FOLK.TAG_R) { m = s; kind = 'skel'; break; }
    if (!m || (m.bahCD || 0) > Game.time) continue;
    u.tagAt = Game.time + 10;
    if (Math.random() >= FOLK.TAG_P) continue;
    u.tagAt = Game.time + FOLK.TAG_CD;
    startBreak(u, 'tag', null);
    u.proc = (function* () {
      floater(u.x, u.y - 1.1, folkPick(['Догоню-у!', 'Чур, ты водишь!', 'А ну, стой!']), '#fff2a0');
      const [mx, my] = bahXY(m, kind);
      const tx = Math.floor(u.x + Math.sign(mx - u.x) * 2), ty = Math.floor(u.y + Math.sign(my - u.y));
      if (inb(tx, ty) && isWalkable(tx, ty)) yield { walk: [tx, ty], offroad: true };
      if (u.dead) return;
      folkScare(m, kind, u);
      folkG().st.tag++;
      logEvent('night', `${folkName(u)} догонялками спугнул${u.fam && u.fam.sx === 'f' ? 'а' : ''} нечисть: ${BAH_NAME[kind]} удрал${kind === 'bat' ? 'а' : ''}`, u.x, u.y);
      u.gest = 'clap'; u.gestUntil = Game.time + 1.4;
      yield { wait: 1.4 };
    })();
  }
}

// ---------- Ход времени ----------
const FOLKT = { acc: 0 };
function folkTick(dt) {
  FOLKT.acc += dt;
  if (FOLKT.acc < 1) return;
  FOLKT.acc = 0;
  for (const u of Game.units) if (!u.dead && u.smoker && (folkKid(u) || folkFem(u))) u.smoker = false;   // гномки и гномята не курят
  folkTagTick();
}

// ---------- Рисование ----------

// игрушечный пистолет: рыжая рукоять, красный корпус, жёлтый ствол (в мировых пикселях, дулом вправо)
function drawToyGun(c) {
  c.fillStyle = '#1c1216'; c.fillRect(-1.2, -1.4, 6.6, 2.6); c.fillRect(-1.2, -0.2, 2.6, 3.6);
  c.fillStyle = '#c84a1e'; c.fillRect(-0.7, 0, 1.7, 2.9);                 // рукоять
  c.fillStyle = '#e03a2a'; c.fillRect(-0.7, -0.9, 4.6, 1.6);              // корпус
  c.fillStyle = '#ffd040'; c.fillRect(3.6, -0.7, 1.4, 1.2);               // ствол
  c.fillStyle = '#ffffff'; c.fillRect(0, -0.8, 1.2, 0.4);                 // блик
}

// комикс-облачко с надписью, k — 0…1 раскрытие
function drawBahCloud(c, x, y, k, a) {
  c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(k, k);
  c.beginPath();
  for (let i = 0; i < 20; i++) { const ang = i / 20 * Math.PI * 2, r = i % 2 ? 6.2 : 9.6; c.lineTo(Math.cos(ang) * r * 1.25, Math.sin(ang) * r * 0.8); }
  c.closePath();
  c.fillStyle = '#1c1216'; c.fill();
  c.scale(0.86, 0.84); c.fillStyle = '#fff8d8'; c.fill();
  c.restore();
  c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(k, k);
  c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#1c1216'; c.fillText('Бах!', 0.5, 0.9);
  c.fillStyle = '#e8302a'; c.fillText('Бах!', 0, 0.4);
  c.restore();
}

// вспышка у дула: 6 кадров
function drawBahFlash(c, x, y, f) {
  const R = [1.6, 3.2, 2.6, 1.8, 1, 0][f];
  if (!R) return;
  c.fillStyle = f < 2 ? '#ffffff' : '#fff6a0';
  c.beginPath();
  for (let i = 0; i < 10; i++) { const ang = i / 10 * Math.PI * 2, r = i % 2 ? R * 0.45 : R; c.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r); }
  c.closePath(); c.fill();
  if (f < 3) { c.fillStyle = '#ffd040'; c.fillRect(x - 0.6, y - 0.6, 1.2, 1.2); }
}

function folkDrawBah(c, u) {
  const B = u.bah;
  if (!B) return;
  const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
  const t = Game.time - B.t, f = B.f || 1, S = 0.68;
  // выхват: 4 кадра — от бедра к вытянутой руке
  const df = Math.min(3, Math.floor(t / 0.1));
  const ang = [1.3, 0.85, 0.4, 0][df];
  const hx = px + f * (df < 3 ? 2.6 + df * 0.4 : 4) * S * 1.4, hy = py + (df < 3 ? -7.4 - df * 0.8 : -9.6) * S * 1.3;
  c.save();
  c.translate(Math.round(hx), Math.round(hy));
  c.scale(f, 1); c.rotate(ang);
  const kick = B.s && Game.time - B.s < 0.12 ? -0.5 : 0;                          // отдача
  c.rotate(kick);
  drawToyGun(c);
  // пробка на верёвочке вылетела
  if (B.s) {
    const st = Math.min(1, (Game.time - B.s) / 0.25);
    c.strokeStyle = '#efe6d0'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(5, 0); c.quadraticCurveTo(7 + st * 2, 2 - st, 6 + st * 4, 1.6 * (1 - st) + 1.2); c.stroke();
    c.fillStyle = '#b07a40'; c.fillRect(5.6 + st * 4, 0.6 + 1.6 * (1 - st), 1.4, 1.2);
  }
  c.restore();
  if (!B.s) return;
  const st = Game.time - B.s, fr = Math.min(5, Math.floor(st / 0.1));
  const mx = hx + f * 6, my = hy;
  drawBahFlash(c, mx, my, fr);
  if (st < 1.5) {
    const k = fr < 2 ? 0 : fr === 2 ? 0.55 : fr === 3 ? 1 : fr === 4 ? 1.1 : 1;
    const a = st > 1.1 ? Math.max(0, 1 - (st - 1.1) / 0.4) : 1;
    if (k) drawBahCloud(c, mx + f * 8, my - 9, k, a);
  }
}

if (typeof drawUnit === 'function') {
  const _du = drawUnit;
  drawUnit = function (c, u) {
    if (u.type !== 'kid') { _du(c, u); return; }
    // гномёнок на бегу подпрыгивает
    const a = u.action, hop = a && a.walk && a.path && !(u.pauseUntil > Game.time) ? Math.abs(Math.sin((u.walkPhase || 0) * 0.7)) * 1.4 : 0;
    if (hop) { c.save(); c.translate(0, -Math.round(hop)); _du(c, u); c.restore(); } else _du(c, u);
    if (u.bah) folkDrawBah(c, u);
  };
}

// ---------- Карточка жителя ----------
if (typeof famCardHTML === 'function') {
  const _fc = famCardHTML;
  famCardHTML = function (u) {
    const h = _fc(u);
    if (!h || !u || !u.fam) return h;
    const f = u.fam, kid = u.type === 'kid';
    const who = kid ? (f.sx === 'f' ? 'гномочка' : 'гномёнок') : f.sx === 'f' ? 'гномка' : 'гном';
    const role = kid ? (f.ls ? `учится: ${f.ls} ${f.ls % 10 === 1 && f.ls % 100 !== 11 ? 'урок' : f.ls % 10 >= 2 && f.ls % 10 <= 4 && (f.ls % 100 < 12 || f.ls % 100 > 14) ? 'урока' : 'уроков'}` : 'играет и растёт') : UNIT_TYPES[u.type].name.toLowerCase();
    const perk = kid ? 'Не пьёт и не курит; нечисть не утащит — у него игрушечный пистолет' : f.sx === 'f' ? 'Не курит, пьёт редко; на поле и у печи проворнее, выхаживает больных; с нечистью не дерётся' : '';
    const row = `<div class="irow small">Пол: ${who} · роль: ${role}</div>${perk ? `<div class="irow small muted">${perk}</div>` : ''}`;
    const i = h.indexOf('</div>', h.indexOf('fm-name'));
    return i >= 0 ? h.slice(0, i + 6) + row + h.slice(i + 6) : h + row;
  };
}

// ---------- Ачивка ----------
if (typeof ACHS !== 'undefined' && !ACH_BY.bah) {
  const a = { id: 'bah', name: 'Бах!', desc: 'Гномёнок пальнул из игрушечного пистолета — и нечисть удрала. Детей не трогать!', ev: /пальнул из игрушечного пистолета/ };
  ACHS.push(a); ACH_BY.bah = a;
}

// ---------- Подключение ----------
if (typeof step === 'function') {
  const _step = step;
  step = function (dt) { _step(dt); if (!folkMirror()) folkTick(dt); };
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); Game.folk = null; };
  const _sg = serializeGame;
  serializeGame = function () {
    const s = _sg();
    if (Game.folk) s.folk = { st: Game.folk.st };
    Game.units.forEach((u, k) => { const d = s.units && s.units[k]; if (d && d.fam && u.fam && u.fam.ls) d.fam.ls = u.fam.ls; });
    return s;
  };
  const _as = applySave;
  applySave = function (s) {
    _as(s);
    // сейв до семей: все жители — взрослые мужчины (новых гномок приведут беженцы и рождения)
    // (семья заводится лениво, famOf ниже: помечаем, кем она должна быть)
    if (!s.fam) (s.units || []).forEach((d, k) => { const u = Game.units[k]; if (u && d && !d.fam) { u.fam = null; u.folkOld = true; } });
    (s.units || []).forEach((d, k) => { const u = Game.units[k]; if (u && u.fam && d && d.fam && Number.isInteger(d.fam.ls)) u.fam.ls = Math.max(0, Math.min(999, d.fam.ls)); });
    for (const u of Game.units) { u.bah = null; if (folkKid(u) || folkFem(u)) u.smoker = false; }
    Game.folk = null;
    const m = s.folk;
    if (m && m.st && typeof m.st === 'object') { const G = folkG(); for (const k in G.st) if (Number.isFinite(m.st[k])) G.st[k] = Math.max(0, m.st[k] | 0); }
  };
}
