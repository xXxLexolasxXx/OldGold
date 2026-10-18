'use strict';
// Сказочные существа (первая партия). Звуков нет — только всплывающие надписи.
//  • ДОМОВОЙ живёт за печкой пекарни и мельницы. Вечером пекарь/мельник ставит блюдце молока (иногда «забывает»).
//    Накормленный ночью чинит здание и сам печёт/мелет; обиженный прячет инструмент (здание встаёт до починки) и роняет груз.
//    Виден редко: ночью из темноты светятся глаза, а раз в несколько минут мелькает силуэт.
//  • ЕДИНОРОГ выходит на берег у родника ясным вечером, лечит раненых поблизости, пугается тех, кто подошёл слишком близко.
//  • ДРАКОНЧИК живёт в горах, днём прилетает за золотом (кучки и склад), иногда поджигает поле. Герой может его приручить.
//  • ГРИФОН патрулирует горы и охраняет сокровище. Нейтрал: жителей только пугает, но герой и рекруты могут вызвать его на бой.
//  • САЛАМАНДРА селится у плавильни и оружейной; когда там топят, горит ярче и работа идёт на ~10% быстрее.
//  • ЗОЛОТАЯ РЫБКА изредка плещется у берега: поймавший герой получает выкуп золотом.
//  • ЗОЛОТОЙ ГУСЬ изредка ходит со стаей и раз в сутки несёт золотое яйцо, если стаю не обижать.
// Итоги идут в Game.faunaStat (fstat), состояние — в сохранение (поле fy). Спрайты собираются в коде из прямоугольников.

Game.fairy = null;

const FY_SEE = (x, y, x0, y0, x1, y1) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 3 && y <= y1 + 3;
const fyDay = () => cycleAt(Game.time).k;
const fyHero = () => Game.units.find(u => u.type === 'hero' && !u.dead && !u.inside);
const fyR = (a, b) => a + Math.random() * (b - a);
const fyIsWater = (x, y) => inb(x, y) && World.terrain[idx(x, y)] === T_WATER;
const fyIsRock = (x, y) => inb(x, y) && World.terrain[idx(x, y)] === T_ROCK;
const fyFree = (x, y) => inb(x, y) && isWalkable(x, y) && !World.bmap[idx(x, y)] && !World.road[idx(x, y)];

function fyState() {
  if (!Game.fairy) Game.fairy = { bw: [], chk: new Set(), sal: [], salChk: new Set(), uni: null, uniDay: -1, uniRoll: -1, dr: null, gr: null, fish: null, gg: null, ggDay: -1, ggEgg: -1, t: 0, nests: false };
  return Game.fairy;
}
function fyBuilding(id) { return Game.buildings.find(b => b.id === id && !b.removed && b.state === 'done'); }

// шаг к цели; возвращает остаток расстояния
function fyMove(o, tx, ty, spd, dt) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d < 0.001) return 0;
  const s = Math.min(d, spd * dt);
  o.x += dx / d * s; o.y += dy / d * s;
  if (Math.abs(dx) > 0.02) o.face = dx > 0 ? 1 : -1;
  return d - s;
}

// ---------- Спрайты ----------
const fyCache = new Map();
function fySpr(key, w, h, draw) {
  let cv = fyCache.get(key);
  if (cv) return cv;
  cv = mkCanvas(w, h);
  draw(cv.getContext('2d'));
  fyCache.set(key, cv);
  return cv;
}
// рисует спрайт с низом по центру в точке (px, py); flip — зеркально
function fyBlit(c, spr, px, py, face = 1, alpha = 1, scale = 1) {
  c.save();
  c.imageSmoothingEnabled = false;
  c.globalAlpha = alpha;
  c.translate(Math.round(px), Math.round(py));
  if (face < 0) c.scale(-1, 1);
  if (scale !== 1) c.scale(scale, scale);
  c.drawImage(spr, -Math.round(spr.width / 2), -spr.height);
  c.restore();
  c.imageSmoothingEnabled = R.smooth;
}
function fyShadow(c, px, py, rx, a = 0.3) {
  c.fillStyle = `rgba(10,8,4,${a})`; c.beginPath(); c.ellipse(px, py, rx, rx * 0.3, 0, 0, 7); c.fill();
}

function sprUnicorn(fr) {
  return fySpr('uni' + fr, 26, 20, c => {
    const w = '#f6f2f6', W = '#c8c2d4', p = '#e07ab8', P = '#a8508c', k = '#2a2236';
    R_(c, 1, 8, 3, 3, p); R_(c, 0, 10, 3, 6, p); R_(c, 1, 14, 2, 2, P); R_(c, 2, 9, 1, 5, P);              // хвост
    R_(c, 4, 7, 13, 7, w); R_(c, 4, 13, 13, 1, W); R_(c, 5, 7, 11, 1, '#ffffff');                           // тело
    const legs = fr ? [[5, 3], [8, 0], [13, 0], [15, 3]] : [[5, 0], [8, 3], [13, 3], [15, 0]];
    for (const [x, o] of legs) { R_(c, x, 14, 2, 4, w); R_(c, x, 17, 2, 1, W); R_(c, x + (o ? 1 : 0), 18, 2, 2, k); }
    R_(c, 15, 4, 4, 7, w); R_(c, 15, 4, 1, 7, p);                                                           // шея и грива
    R_(c, 17, 2, 6, 5, w); R_(c, 21, 4, 4, 3, w); R_(c, 24, 5, 1, 1, W); R_(c, 20, 3, 1, 1, '#4a2a80');     // голова, глаз
    R_(c, 17, 1, 1, 2, w); R_(c, 15, 2, 2, 5, p); R_(c, 15, 6, 1, 4, P); R_(c, 16, 3, 1, 1, P);             // ухо, чёлка
    R_(c, 21, 0, 1, 1, '#f0d060'); R_(c, 20, 1, 1, 1, '#f0d060'); R_(c, 19, 2, 1, 1, '#b8902c');            // рог
  });
}
function sprDragon(fr) {
  return fySpr('dra' + fr, 26, 20, c => {
    const g = '#4aa04c', G = '#8ccf6c', d = '#2a6034', y = '#f0d870', r = '#c84a3a', k = '#1a1a22';
    R_(c, 0, 12, 4, 2, g); R_(c, 0, 11, 2, 1, d); R_(c, 3, 11, 5, 4, g);                                    // хвост
    R_(c, 6, 8, 10, 7, g); R_(c, 6, 13, 10, 2, y); R_(c, 8, 8, 8, 1, G); R_(c, 6, 14, 10, 1, '#c8b050');
    for (let x = 7; x < 15; x += 3) R_(c, x, 7, 1, 1, d);                                                    // гребень
    R_(c, 8, 15, 2, 3, d); R_(c, 13, 15, 2, 3, d); R_(c, 7, 17, 3, 1, k); R_(c, 12, 17, 3, 1, k);
    R_(c, 15, 6, 7, 6, g); R_(c, 21, 8, 4, 3, g); R_(c, 15, 6, 7, 1, G); R_(c, 24, 8, 1, 1, d);              // голова, морда
    R_(c, 18, 7, 2, 2, '#fff2a0'); R_(c, 19, 7, 1, 2, k); R_(c, 16, 3, 1, 3, '#d8c8a0'); R_(c, 19, 4, 1, 2, '#d8c8a0');   // глаз, рожки
    if (fr) { R_(c, 6, 11, 8, 3, d); R_(c, 8, 13, 5, 2, r); R_(c, 4, 12, 3, 2, d); }                         // крылья вниз
    else { R_(c, 6, 1, 3, 8, d); R_(c, 8, 0, 5, 3, d); R_(c, 9, 3, 4, 5, r); R_(c, 7, 2, 1, 6, '#1a4a24'); R_(c, 13, 2, 1, 5, d); }   // крылья вверх
  });
}
function sprGriffin(fr) {
  return fySpr('gri' + fr, 40, 30, c => {
    const t = '#c88a3c', T = '#8a5a22', w = '#f4ecd4', W = '#c8b890', y = '#f0c040', k = '#1a1612', n = '#6a4420', N = '#3e2a14';
    R_(c, 2, 14, 3, 4, t); R_(c, 0, 17, 5, 5, n); R_(c, 1, 18, 3, 3, T);                                     // хвост с кисточкой
    R_(c, 5, 14, 17, 9, t); R_(c, 5, 21, 17, 2, T); R_(c, 6, 14, 15, 1, '#e8a85a');                          // тело льва
    R_(c, 6, 23, 3, 5, t); R_(c, 6, 27, 3, 2, T); R_(c, 12, 23, 3, 4, T);                                    // задние лапы
    R_(c, 18, 23, 2, 4, y); R_(c, 17, 27, 4, 2, y); R_(c, 22, 23, 2, 4, y); R_(c, 22, 27, 4, 2, '#c89828'); // передние: орлиные
    R_(c, 20, 9, 6, 10, w); R_(c, 20, 9, 1, 10, W); R_(c, 22, 14, 4, 5, '#d8c8a0');                         // шея и грудь
    R_(c, 22, 3, 8, 7, w); R_(c, 22, 3, 8, 1, '#ffffff'); R_(c, 30, 6, 6, 3, y); R_(c, 34, 8, 2, 4, y); R_(c, 30, 5, 5, 1, '#f8d870');   // голова, клюв
    R_(c, 26, 5, 2, 2, '#e8a020'); R_(c, 27, 5, 1, 2, k); R_(c, 23, 1, 2, 3, w); R_(c, 22, 2, 1, 2, W);     // глаз, перья на затылке
    if (fr) { R_(c, 4, 18, 18, 4, n); for (let x = 4; x < 22; x += 3) R_(c, x, 21, 2, 3, N); R_(c, 6, 17, 12, 1, T); }   // крылья опущены
    else { R_(c, 5, 8, 14, 6, n); R_(c, 8, 4, 10, 5, n); R_(c, 11, 1, 6, 4, n); R_(c, 14, 0, 3, 2, N); for (let x = 5; x < 19; x += 3) R_(c, x, 13, 2, 3, N); R_(c, 7, 9, 11, 1, T); R_(c, 10, 5, 7, 1, T); }
  });
}
function sprBrownie() {
  return fySpr('brw', 14, 18, c => {
    const k = '#17131f', h = '#2a2436';
    R_(c, 4, 0, 6, 2, h); R_(c, 3, 2, 8, 5, k); R_(c, 2, 6, 10, 8, k); R_(c, 4, 12, 6, 4, '#2c2434');          // колпак, голова, борода-тело
    R_(c, 2, 8, 2, 5, h); R_(c, 10, 8, 2, 5, h); R_(c, 3, 15, 3, 2, k); R_(c, 8, 15, 3, 2, k);
    R_(c, 4, 4, 2, 1, '#f4e048'); R_(c, 8, 4, 2, 1, '#f4e048');                                              // глаза
  });
}
function sprBowl(full) {
  return fySpr('bowl' + full, 8, 4, c => {
    R_(c, 0, 1, 8, 1, '#8a8a98'); R_(c, 1, 2, 6, 2, '#6a6a7a'); R_(c, 1, 1, 6, 1, full ? '#fffdf4' : '#4a4a58'); R_(c, 2, 0, 3, 1, full ? '#fffdf4' : 'rgba(0,0,0,0)');
  });
}
function sprSalamander(fr) {
  return fySpr('sal' + fr, 16, 9, c => {
    const o = '#ec7a28', O = '#a8421a', f = '#ffd860', k = '#1a1010';
    R_(c, 0, 5, 3, 2, o); R_(c, 0, 6, 2, 1, f); R_(c, 2, 4, 8, 3, o); R_(c, 3, 4, 1, 1, f); R_(c, 6, 4, 1, 1, f); R_(c, 2, 6, 8, 1, O);
    R_(c, 9, 3, 5, 4, o); R_(c, 13, 5, 2, 1, O); R_(c, 11, 3, 1, 1, k); R_(c, 12, 4, 1, 1, f);
    R_(c, fr ? 3 : 4, 7, 1, 2, O); R_(c, fr ? 8 : 7, 7, 1, 2, O); R_(c, 11, 7, 1, 2, O);
  });
}
function sprFish(fr) {
  return fySpr('fish' + fr, 14, 8, c => {
    const q = '#f4c840', Q = '#b88a1c', e = '#fff6c0';
    R_(c, 3, 2, 8, 4, q); R_(c, 4, 1, 5, 1, Q); R_(c, 3, 5, 7, 1, Q); R_(c, 11, 3, 2, 2, q);
    if (fr) { R_(c, 0, 0, 3, 3, Q); R_(c, 0, 5, 3, 3, Q); R_(c, 1, 3, 2, 2, Q); } else { R_(c, 0, 1, 3, 2, Q); R_(c, 0, 5, 3, 2, Q); R_(c, 1, 3, 2, 2, Q); }
    R_(c, 9, 3, 1, 1, '#1a1208'); R_(c, 5, 3, 1, 1, e); R_(c, 7, 2, 1, 1, e);
  });
}
function sprGoose(fr) {
  return fySpr('gg' + fr, 20, 18, c => {
    const q = '#f4cc40', Q = '#c8982a', e = '#fff2a0', o = '#e8782a';
    R_(c, 2, 7, 11, 6, q); R_(c, 0, 6, 4, 3, q); R_(c, 3, 7, 9, 1, e); R_(c, 3, 12, 10, 1, Q); R_(c, 5, 9, 5, 2, Q);        // тело, хвост, крыло
    R_(c, 11, 2, 3, 7, q); R_(c, 11, 2, 1, 7, e); R_(c, 12, 0, 4, 3, q); R_(c, 15, 1, 4, 2, o); R_(c, 14, 1, 1, 1, '#1a1208');
    R_(c, fr ? 5 : 6, 13, 1, 4, o); R_(c, fr ? 9 : 8, 13, 1, 4, o); R_(c, fr ? 4 : 5, 16, 3, 1, o); R_(c, fr ? 8 : 7, 16, 3, 1, o);
  });
}
function sprEgg() { return fySpr('egg', 5, 6, c => { R_(c, 1, 0, 3, 1, '#f4cc40'); R_(c, 0, 1, 5, 4, '#f4cc40'); R_(c, 1, 5, 3, 1, '#c8982a'); R_(c, 1, 1, 1, 2, '#fff6c0'); }); }

// ---------- Домовой ----------
function fyDoor(b) { return [b.doorX + 0.5, b.doorY + 0.5]; }

function brownieTick(dt, F) {
  F.bT = (F.bT || 0) - dt;
  if (F.bT <= 0) {
    F.bT = 6;
    for (const b of Game.buildings) {
      if (b.state !== 'done' || b.removed || (b.type !== 'bakery' && b.type !== 'mill') || F.chk.has(b.id)) continue;
      F.chk.add(b.id);
      if (F.bw.length < 3 && Math.random() < 0.4) F.bw.push({ bid: b.id, milk: -1, dec: -1, prank: -1, logK: -1, tt: 0, act: 15, pk: 0, nextPk: fyR(30, 90), ph: Math.random() * 9 });
    }
  }
  const nt = nightAmt(), k = nightIndex(), ev = isEveningNow(), deep = nt > 0.5 && !isDawnNow();
  for (let i = F.bw.length - 1; i >= 0; i--) {
    const br = F.bw[i], b = fyBuilding(br.bid);
    if (!b) { F.bw.splice(i, 1); continue; }
    br.ph += dt;
    if (br.pk > 0) br.pk -= dt;
    br.tt += dt;
    if (br.tt < 1) continue;
    br.tt = 0;
    const [dx, dy] = fyDoor(b), who = b.type === 'bakery' ? 'Пекарь' : 'Мельник';
    // вечером решает, ставить ли блюдце
    if (ev && br.dec !== k && b.worker && !b.worker.dead) {
      br.dec = k;
      if (Math.random() < 0.8) {
        br.milk = k; floater(dx + 0.7, dy - 0.2, 'Блюдце!', '#f4f0e0'); fstat('hMilk');
        logEvent('animal', `${who} поставил блюдце молока домовому`, dx, dy);
      } else logEvent('animal', `${who} забыл про блюдце молока для домового`, dx, dy);
    }
    if (!deep) continue;
    br.nextPk -= 1;
    if (br.nextPk <= 0) { br.nextPk = fyR(70, 150); br.pk = 5; }
    br.act -= 1;
    if (br.act > 0) continue;
    br.act = fyR(22, 40);
    const fed = br.milk === k;
    if (fed) {
      let did = null;
      if (b.dmg > 0.02) { b.dmg = Math.max(0, b.dmg - 0.18); did = 'починил'; fstat('hFix'); }
      else if (b.type === 'bakery' && b.stock.flour >= 1 && b.stock.bread + 3 <= b.def.outputs.bread) { b.stock.flour--; b.stock.bread += 3; Game.produced.bread += 3; did = 'испёк хлеб в'; fstat('hBake'); }
      else if (b.type === 'mill' && b.stock.wheat >= 1 && b.stock.flour + 1 <= b.def.outputs.flour) { b.stock.wheat--; b.stock.flour++; Game.produced.flour++; did = 'смолол муку в'; fstat('hBake'); }
      if (did) {
        floater(dx, dy - 0.8, did === 'починил' ? 'Тук-тук!' : 'Хлебушек!', '#ffe9b0'); br.pk = Math.max(br.pk, 2.5);
        if (br.logK !== k) { br.logK = k; logEvent('animal', `Домовой за ночь ${did === 'починил' ? 'починил здание' : did + ' ' + (b.type === 'bakery' ? 'пекарне' : 'мельнице')}`, dx, dy); }
      }
    } else if (br.prank !== k && Math.random() < 0.5) {
      br.prank = k; fstat('hPrank');
      const w = b.worker;
      if (w && w.carry && !w.dead) { const g = dropLoad(w); floater(w.x, w.y - 1.3, 'Ой!', '#ffc8a0'); if (g) logEvent('animal', `Домовой подставил подножку: ${UNIT_TYPES[w.type].name.toLowerCase()} уронил груз`, w.x, w.y); }
      if (b.dmg < 0.5) { b.dmg = 0.52; floater(dx, dy - 0.8, 'Хи-хи!', '#c8b0ff'); logEvent('animal', `Домовой спрятал инструмент: ${b.def.name.toLowerCase()} стоит, пока не найдут`, dx, dy); toast(`Домовой обиделся без молока и спрятал инструмент: ${b.def.name.toLowerCase()}`); }
    }
  }
}

function brownieDraw(list, c, F, x0, y0, x1, y1) {
  const nt = nightAmt(), k = nightIndex();
  for (const br of F.bw) {
    const b = fyBuilding(br.bid);
    if (!b || !FY_SEE(b.doorX, b.doorY, x0, y0, x1, y1)) continue;
    const [dx, dy] = fyDoor(b);
    if (isEveningNow() && br.milk === k) list.push([dy + 0.3, () => fyBlit(c, sprBowl(1), (dx + 0.75) * TILE, (dy + 0.1) * TILE + 6)]);
    if (nt < 0.3) continue;
    list.push([dy + 0.35, () => {
      const a = Math.min(1, (nt - 0.3) * 2);
      if (br.pk > 0) {                                    // мелькнул силуэт
        const f = Math.min(1, br.pk / 1.2, (5 - br.pk) / 0.8 + 0.01);
        fyBlit(c, sprBrownie(), (dx - 0.8) * TILE, (dy + 0.25) * TILE, 1, 0.82 * Math.max(0, Math.min(1, f)) * a);
      } else if (Math.sin(br.ph * 0.7) > -0.2) {          // только глаза в темноте у печки
        const ex = Math.round((dx - 0.9) * TILE), ey = Math.round((dy - 0.5) * TILE), bl = Math.sin(br.ph * 2.3) > 0.93;
        if (!bl) { c.fillStyle = `rgba(250,226,70,${0.9 * a})`; c.fillRect(ex, ey, 2, 1); c.fillRect(ex + 5, ey, 2, 1); c.fillStyle = `rgba(250,226,70,${0.18 * a})`; c.fillRect(ex - 1, ey - 1, 4, 3); c.fillRect(ex + 4, ey - 1, 4, 3); }
      }
    }]);
  }
}

// ---------- Единорог ----------
function uniFindSpot() {
  const cx = MAP_W >> 1, cy = MAP_H >> 1;
  for (let t = 0; t < 300; t++) {
    const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
    if (!fyIsWater(x, y) || Math.hypot(x - cx, y - cy) < 7) continue;
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const lx = x + ax * 2, ly = y + ay * 2;
      if (fyFree(lx, ly) && fyFree(x + ax, y + ay)) return [lx, ly];
    }
  }
  return null;
}
let lastUniToast = -99;

function unicornTick(dt, F) {
  let u = F.uni;
  if (!u) {
    F.uT = (F.uT || 0) - dt;
    if (F.uT > 0) return;
    F.uT = 5;
    const k = nightIndex(), nt = nightAmt();
    if (k < 1 || F.uniRoll === k || !isEveningNow() || nt < 0.03 || nt > 0.32 || isRaining() || isDawnNow()) return;
    F.uniRoll = k;
    const hurt = Game.units.some(x => x.injury && isPerson(x));
    if (Math.random() > (hurt ? 0.5 : 0.22)) return;
    const s = uniFindSpot();
    if (!s) return;
    F.uni = u = { x: s[0] + 0.5, y: s[1] + 0.5, face: 1, st: 'graze', t: 0, life: 75, ph: 0, heal: 0, mv: false, tg: null };
    fstat('uniSeen');
    logEvent('animal', 'У родника на вечерней поляне появился единорог', u.x, u.y);
    if (Game.time - lastUniToast > 120) { lastUniToast = Game.time; toast('На поляне у родника показался единорог — не пугайте его, он лечит раненых'); }
    floater(u.x, u.y - 1.6, 'Тсс…', '#e8d8ff');
    return;
  }
  u.ph += dt; u.t += dt;
  const hero = fyHero();
  const close = nearestPerson(u, 2.3, p => isPerson(p) && p.type !== 'carter');
  const nearHero = hero && Math.hypot(hero.x - u.x, hero.y - u.y) < 3.2;
  if (u.st !== 'flee' && u.st !== 'gone' && (close || nearHero)) {
    u.st = 'flee'; u.t = 0; u.fa = Math.atan2(u.y - (close || hero).y, u.x - (close || hero).x);
    floater(u.x, u.y - 1.6, 'Иго-го!', '#ffd0f0'); fstat('uniScare');
    logEvent('animal', 'Единорог испугался и ускакал', u.x, u.y);
    fxBurst(u.x * TILE, u.y * TILE - 14, 12, ['#f8e8ff', '#ffc0e8', '#c8d8ff'], 70, 40, 0.6, 1.6, 40);
  }
  if (u.st === 'flee') {
    const nx = u.x + Math.cos(u.fa) * 6 * dt, ny = u.y + Math.sin(u.fa) * 6 * dt;
    if (inb(nx | 0, ny | 0) && !fyIsWater(nx | 0, ny | 0) && !World.bmap[idx(nx | 0, ny | 0)]) { u.x = nx; u.y = ny; } else u.fa += 1.2;
    u.face = Math.cos(u.fa) > 0 ? 1 : -1; u.mv = true;
    if (u.t > 3.5) F.uni = null;
    return;
  }
  u.life -= dt;
  if (u.life <= 0) { fxBurst(u.x * TILE, u.y * TILE - 14, 14, ['#f8e8ff', '#ffc0e8', '#fff2a0'], 60, 50, 0.9, 1.6, 20); logEvent('animal', 'Единорог растворился в вечернем свете', u.x, u.y); F.uni = null; return; }
  // ближайший раненый (или герой с ранами)
  let tg = null, bd = 16;
  for (const p of Game.units) {
    if (p.dead || p.inside || !isPerson(p)) continue;
    const need = p.injury || (p.hero && p.hero.hp < p.hero.maxhp * 0.8);
    if (!need) continue;
    const d = Math.hypot(p.x - u.x, p.y - u.y);
    if (d < bd) { bd = d; tg = p; }
  }
  u.mv = false;
  if (tg && bd > 4.2) {      // подходит на расстояние, не вплотную
    const d = Math.hypot(tg.x - u.x, tg.y - u.y);
    const tx = tg.x + (u.x - tg.x) / d * 3.6, ty = tg.y + (u.y - tg.y) / d * 3.6;
    const ox = u.x, oy = u.y;
    fyMove(u, tx, ty, 1.7, dt);
    if (!inb(u.x | 0, u.y | 0) || fyIsWater(u.x | 0, u.y | 0) || World.bmap[idx(u.x | 0, u.y | 0)]) { u.x = ox; u.y = oy; } else u.mv = true;
  }
  if (tg && bd <= 4.4) {
    u.heal += dt;
    if (u.heal > 2.2) {
      u.heal = 0;
      if (tg.injury) { tg.injury = null; tg.injuryUntil = 0; }
      if (tg.hero) tg.hero.hp = Math.min(tg.hero.maxhp, tg.hero.hp + tg.hero.maxhp * 0.2);
      floater(tg.x, tg.y - 1.4, 'Здоров!', '#a0ffb0'); fstat('uniHeal');
      fxBurst(tg.x * TILE, tg.y * TILE - 10, 12, ['#f8e8ff', '#a0ffb0', '#fff2a0'], 40, 50, 0.9, 1.6, -20);
      logEvent('animal', `Единорог вылечил: ${tg.hero ? tg.hero.name : UNIT_TYPES[tg.type].name.toLowerCase()}`, tg.x, tg.y);
    }
  } else u.heal = 0;
}

function unicornDraw(list, c, F, x0, y0, x1, y1) {
  const u = F.uni;
  if (!u || !FY_SEE(u.x, u.y, x0, y0, x1, y1)) return;
  list.push([u.y + 0.1, () => {
    const px = u.x * TILE, py = u.y * TILE + 4, fr = u.mv ? (Math.floor(u.ph * (u.st === 'flee' ? 10 : 4)) & 1) : 0;
    const a = u.life < 3 && u.st !== 'flee' ? Math.max(0, u.life / 3) : 1;
    fyShadow(c, px, py, 11);
    const rear = u.st === 'flee' && Math.floor(u.t * 9) % 6 === 0 ? 1 : 0;
    fyBlit(c, sprUnicorn(fr), px, py - (u.st === 'flee' ? Math.abs(Math.sin(u.ph * 9)) * 3 : 0) - rear, u.face, a);
    // мерцание
    if ((Math.floor(u.ph * 7) % 3) === 0) { c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(Math.round(px + Math.sin(u.ph * 3) * 12), Math.round(py - 14 + Math.cos(u.ph * 4) * 8), 1, 1); }
  }]);
}

// ---------- Гнёзда: дракончик и грифон ----------
function fyNests(F) {
  if (F.nests) return;
  F.nests = true;
  const cx = MAP_W >> 1, cy = MAP_H >> 1, cands = [];
  for (let y = 2; y < MAP_H - 2; y++) for (let x = 2; x < MAP_W - 2; x++) {
    if (!fyIsRock(x, y) || Math.hypot(x - cx, y - cy) < 12) continue;
    let d = 0;
    for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) if (fyIsRock(x + xx, y + yy)) d++;
    if (d >= 14) cands.push([x, y]);
  }
  F.rocks = cands;
  const pick = (far) => { for (let t = 0; t < 40 && cands.length; t++) { const q = cands[(Math.random() * cands.length) | 0]; if (!far || Math.hypot(q[0] - far[0], q[1] - far[1]) > 8) return q; } return cands[0] || null; };
  if (!F.dr) { const q = F.drSaved || pick(); if (q) F.dr = { nx: q[0], ny: q[1], x: q[0] + 0.5, y: q[1] + 0.5, z: 0, st: 'nest', t: fyR(240, 400), tamed: !!(F.drSaved && F.drSaved[2]), loot: 0, face: 1, ph: 0, pet: 120, tx: 0, ty: 0, src: null }; }
  if (!F.gr) { const q = F.grSaved || pick(F.dr ? [F.dr.nx, F.dr.ny] : null); if (q) F.gr = { nx: q[0], ny: q[1], x: q[0] + 0.5, y: q[1] + 0.5, z: 8, tr: q[2] != null ? q[2] : (4 + (Math.random() * 6 | 0)), hp: 70, st: 'patrol', t: 0, face: 1, ph: 0, wx: q[0], wy: q[1], duel: 0, cd: 0, resp: q[3] || 0, seen: 0 }; if (F.gr.resp > 0) { F.gr.st = 'gone'; F.gr.z = 0; } }
}

// ---------- Дракончик ----------
function dragonTarget() {
  const fromPile = Game.piles && [...Game.piles.values()].find(p => !p.removed && p.stock.gold - p.reserved.gold > 0);
  if (fromPile) return { x: fromPile.x + 0.5, y: fromPile.y + 0.5, pile: fromPile };
  const st = Game.buildings.find(b => b.isStore() && b.stock.gold - b.reserved.gold >= 3);
  if (st) return { x: st.doorX + 0.5, y: st.doorY + 0.5, store: st };
  return null;
}
function dragonFire(F, d) {
  let best = null, bd = 14;
  for (let t = 0; t < 400; t++) {
    const x = (d.x + (Math.random() - 0.5) * 24) | 0, y = (d.y + (Math.random() - 0.5) * 24) | 0;
    if (!inb(x, y)) continue;
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'field' && !o.plan) { const dd = Math.hypot(x - d.x, y - d.y); if (dd < bd) { bd = dd; best = [x, y, o]; } }
  }
  return best;
}
let lastDragToast = -99;

function dragonTick(dt, F) {
  const d = F.dr;
  if (!d) return;
  d.ph += dt;
  const hero = fyHero();
  if (d.tamed) {        // приручён: кружит у героя и носит золотишко
    d.st = 'pet'; d.z = 22 + Math.sin(d.ph * 2) * 3;
    const hx = hero ? hero.x : MAP_W / 2, hy = hero ? hero.y : MAP_H / 2;
    const tx = hx - 1.6 + Math.cos(d.ph * 0.8) * 0.8, ty = hy - 0.8 + Math.sin(d.ph * 0.8) * 0.5;
    fyMove(d, tx, ty, Math.max(2.2, Math.hypot(tx - d.x, ty - d.y) * 1.2), dt);
    d.pet -= dt;
    if (d.pet <= 0 && hero) {
      d.pet = fyR(110, 190);
      const n = 1 + (Math.random() * 3 | 0);
      dropPile(Math.floor(hero.x), Math.floor(hero.y) + 1, 'gold', n);
      floater(d.x, d.y - 1.4, 'Блям!', '#ffd700'); fstat('dragPetGold', n);
      logEvent('gold', `Ручной дракончик принёс героя золото ×${n}`, d.x, d.y);
    }
    return;
  }
  if (d.st === 'nest') {
    d.z = 0; d.x = d.nx + 0.5; d.y = d.ny + 0.5;
    d.t -= dt;
    if (d.t > 0) return;
    const done = Game.buildings.filter(b => b.state === 'done').length;
    if (done < 4 || nightAmt() > 0.05 || isRaining()) { d.t = 15; return; }
    const tg = dragonTarget();
    if (!tg) { d.t = 25; return; }
    d.tx = tg.x; d.ty = tg.y; d.src = tg; d.st = 'out'; d.z = 4; d.t = 0;
    return;
  }
  if (d.st === 'out') {
    d.z = Math.min(28, d.z + dt * 14);
    const rest = fyMove(d, d.tx, d.ty, 3.4, dt);
    if (nightAmt() > 0.2) { d.st = 'back'; return; }
    if (rest < 0.25) { d.st = 'land'; d.t = 0; }
    return;
  }
  if (d.st === 'land') {
    d.z = Math.max(0, d.z - dt * 30);
    if (d.z > 0) return;
    d.t += dt;
    const s = shooersNear(d.x, d.y, 3.6, 3, 3);
    if (s) {      // прогнали или герой подошёл
      if (s.hero && !d.triedTame && Math.random() < 0.5) {
        d.tamed = true; d.pet = 90; d.st = 'pet';
        floater(d.x, d.y - 1.6, 'Ур-р!', '#c8ffb0');
        logEvent('animal', 'Герой приручил дракончика!', d.x, d.y); toast('Герой приручил дракончика! Теперь он носит золото'); fstat('dragTame');
        return;
      }
      d.triedTame = true;
      if (d.loot) { dropPile(Math.floor(d.x), Math.floor(d.y), 'gold', d.loot); d.loot = 0; }
      floater(d.x, d.y - 1.4, 'Хр-р!', '#ffb080'); shooWave(s, 'Брысь!'); fstat('dragShoo');
      d.st = 'back'; return;
    }
    if (d.t > 1.4 && !d.loot) {
      const src = d.src;
      let n = 1 + (Math.random() * 3 | 0);
      if (src && src.pile && !src.pile.removed) { n = Math.min(n, src.pile.stock.gold - src.pile.reserved.gold); src.pile.stock.gold -= n; cleanupPile(src.pile); }
      else if (src && src.store && !src.store.removed) { n = Math.min(n, src.store.stock.gold - src.store.reserved.gold); if (n > 0) src.store.stock.gold -= n; }
      else n = 0;
      if (n > 0) {
        d.loot = n; fstat('dragRaid'); fstat('dragGold', n);
        floater(d.x, d.y - 1.4, 'Хр-р!', '#ffb080');
        logEvent('gold', `Дракончик утащил золото ×${n}`, d.x, d.y);
        if (Game.time - lastDragToast > 90) { lastDragToast = Game.time; toast(`Дракончик украл золото ×${n}! Герой может его прогнать или приручить`); }
      }
      d.triedTame = d.triedTame || false;
      d.st = Math.random() < 0.3 ? 'fire' : 'back'; d.t = 0;
      if (d.st === 'fire') { d.fire = dragonFire(F, d); if (!d.fire) d.st = 'back'; }
    }
    return;
  }
  if (d.st === 'fire') {      // летит к полю и дышит огнём
    d.z = Math.min(16, d.z + dt * 20);
    const [fx, fy, o] = d.fire;
    const rest = fyMove(d, fx + 0.5, fy + 0.5, 3, dt);
    if (rest < 0.3) {
      if (World.obj[idx(fx, fy)] === o) {
        o.g = 0; o.ash = false;
        if (typeof WX !== 'undefined' && WX.fires) WX.fires.push({ x: fx + 0.5, y: fy + 0.5, t0: Game.time, life: fyR(4, 7) });
        fxBurst((fx + 0.5) * TILE, (fy + 0.5) * TILE, 18, ['#ffcc50', '#ff8a30', '#ffe890'], 80, 50, 0.8, 2, -10);
        floater(fx + 0.5, fy - 0.4, 'Фр-р-р!', '#ffa060'); fstat('dragFire');
        logEvent('weather', 'Дракончик подпалил поле', fx + 0.5, fy + 0.5);
        toast('Дракончик подпалил поле!');
      }
      d.st = 'back'; d.fire = null;
    }
    return;
  }
  if (d.st === 'back') {
    d.z = Math.min(30, d.z + dt * 16);
    const rest = fyMove(d, d.nx + 0.5, d.ny + 0.5, 4, dt);
    if (rest < 0.4) { d.st = 'nest'; d.t = fyR(180, 360); d.z = 0; d.loot = 0; d.triedTame = false; }
  }
}

function dragonDraw(list, c, F, x0, y0, x1, y1) {
  const d = F.dr;
  if (!d || !FY_SEE(d.x, d.y, x0, y0, x1, y1)) return;
  list.push([d.y + 0.15, () => {
    const px = d.x * TILE, py = d.y * TILE + 4, air = d.z > 1;
    fyShadow(c, px, py, air ? 7 : 9, air ? 0.16 : 0.3);
    if (d.st === 'nest') {      // спит свернувшись на камне, из ноздри дымок
      fyBlit(c, sprDragon(1), px, py, 1, 1, 0.8);
      if (Math.floor(d.ph * 1.5) % 4 === 0) { c.fillStyle = 'rgba(200,200,200,0.5)'; c.fillRect(Math.round(px + 11), Math.round(py - 18 - (d.ph * 6) % 6), 2, 2); }
      return;
    }
    fyBlit(c, sprDragon(air ? (Math.floor(d.ph * 8) & 1) : 1), px, py - d.z, d.face || 1, 1, 0.85);
    if (d.loot && air) { c.save(); c.translate(px + (d.face || 1) * 6, py - d.z + 2); c.scale(0.3, 0.3); drawLoad(c, 'gold'); c.restore(); }
    if (d.st === 'fire' && d.fire) {     // струя огня
      const dir = d.face || 1;
      for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? '#ffd860' : '#ff8a30'; c.fillRect(Math.round(px + dir * (10 + k * 3)), Math.round(py - d.z - 8 + k * 2 + Math.sin(d.ph * 20 + k) * 1.5), 3, 3); }
    }
  }]);
}

// ---------- Грифон ----------
function griffinTick(dt, F) {
  const g = F.gr;
  if (!g) return;
  g.ph += dt; g.cd -= dt;
  if (g.st === 'gone') {
    g.resp -= dt;
    if (g.resp <= 0) { g.st = 'patrol'; g.hp = 70; g.tr = 4 + (Math.random() * 6 | 0); g.x = g.nx + 0.5; g.y = g.ny + 0.5; g.z = 8; g.wx = g.nx; g.wy = g.ny; }
    return;
  }
  // кто у гнезда
  const near = Game.units.filter(u => !u.dead && !u.inside && isPerson(u) && u.type !== 'carter' && Math.hypot(u.x - (g.nx + 0.5), u.y - (g.ny + 0.5)) < 4.2);
  const fighter = near.find(u => (u.hero || u.rec) && Math.hypot(u.x - (g.nx + 0.5), u.y - (g.ny + 0.5)) < 2.6 && typeof neuUnitOut === 'function' && !neuUnitOut(u));
  if (fighter) { g.st = 'duel'; g.foe = fighter.id; }
  else if (g.st === 'duel') { g.st = 'patrol'; g.foe = 0; }
  if (g.st === 'duel') {
    const foe = Game.unitMap.get(g.foe);
    if (!foe || neuUnitOut(foe)) { g.st = 'patrol'; return; }
    g.z = 4; fyMove(g, foe.x - 0.9 * (foe.x > g.x ? 1 : -1), foe.y, 2.5, dt);
    g.face = foe.x > g.x ? 1 : -1;
    g.duel += dt;
    if (g.duel > 1.3) {
      g.duel = 0;
      if (!g.seen) { g.seen = 1; fstat('grifFight'); logEvent('animal', 'Грифон бросился защищать сокровище', g.x, g.y); toast('Грифон защищает своё сокровище!'); }
      neuHurtUnit(foe, 3 + Math.random() * 3); floater(foe.x, foe.y - 1.6, 'Крр-ряу!', '#ffd8a0');
      const dmg = neuDamageOf(foe) * (0.7 + Math.random() * 0.5);
      g.hp -= dmg; floater(g.x, g.y - 2, '−' + Math.round(dmg), '#ffffff');
      if (g.hp <= 0) {
        g.st = 'gone'; g.resp = 600 + Math.random() * 300; g.z = 0;
        dropPile(Math.floor(foe.x), Math.floor(foe.y), 'gold', g.tr);
        dropPile(Math.floor(foe.x), Math.floor(foe.y), 'magicstone', 1);
        fstat('grifWin'); logEvent('gold', `${foe.hero ? foe.hero.name : 'Рекрут'} одолел грифона: сокровище золото ×${g.tr}`, g.x, g.y);
        toast(`Грифон улетел, бросив сокровище: золото ×${g.tr}`);
        floater(g.x, g.y - 1.6, 'Блям!', '#ffd700');
      }
    }
    return;
  }
  if (g.hp < 70) g.hp = Math.min(70, g.hp + dt * 2);
  // гражданских, подошедших к гнезду, пугает
  if (g.cd <= 0) {
    const civ = near.find(u => !u.hero && !u.rec);
    if (civ) {
      g.cd = 25; floater(g.x, g.y - 2, 'Крр!', '#ffd8a0'); scare(civ, g); fstat('grifScare');
      if (Math.random() < 0.3) injure(civ, 'leg');
      logEvent('animal', 'Грифон прогнал гнома от своего гнезда', civ.x, civ.y);
    }
  }
  // патруль: облетает горы и окрестности, иногда садится на гнездо
  g.z = 14 + Math.sin(g.ph * 1.3) * 3;
  g.t -= dt;
  if (g.t <= 0 || Math.hypot(g.wx - g.x, g.wy - g.y) < 0.8) {
    g.t = fyR(12, 28);
    const roll = Math.random();
    if (roll < 0.3) { g.wx = g.nx + 0.5; g.wy = g.ny + 0.5; g.rest = fyR(8, 18); }
    else if (F.rocks && F.rocks.length && roll < 0.75) { const q = F.rocks[(Math.random() * F.rocks.length) | 0]; g.wx = q[0] + 0.5; g.wy = q[1] + 0.5; }
    else { g.wx = Math.max(2, Math.min(MAP_W - 3, g.nx + fyR(-26, 26))); g.wy = Math.max(2, Math.min(MAP_H - 3, g.ny + fyR(-20, 20))); }
  }
  if (g.rest > 0 && Math.hypot(g.nx + 0.5 - g.x, g.ny + 0.5 - g.y) < 0.7) { g.rest -= dt; g.z = 0; return; }
  fyMove(g, g.wx, g.wy, 3.2, dt);
}

function griffinDraw(list, c, F, x0, y0, x1, y1) {
  const g = F.gr;
  if (!g) return;
  if (FY_SEE(g.nx, g.ny, x0, y0, x1, y1) && g.st !== 'gone') {       // сокровище в гнезде
    list.push([g.ny + 0.05, () => { const px = (g.nx + 0.5) * TILE, py = (g.ny + 0.5) * TILE + 6; c.fillStyle = 'rgba(40,24,8,0.55)'; c.beginPath(); c.ellipse(px, py, 11, 4, 0, 0, 7); c.fill(); for (let i = 0; i < Math.min(5, g.tr); i++) { c.save(); c.translate(px - 8 + i * 4, py - 2 - (i & 1)); c.scale(0.4, 0.4); drawLoad(c, 'gold'); c.restore(); } if (Math.floor(Game.time * 2) % 3 === 0) { c.fillStyle = '#fff6b0'; c.fillRect(Math.round(px + Math.sin(Game.time) * 8), Math.round(py - 6), 1, 1); } }]);
  }
  if (g.st === 'gone' || !FY_SEE(g.x, g.y, x0, y0, x1, y1)) return;
  list.push([g.y + 0.3, () => {
    const px = g.x * TILE, py = g.y * TILE + 4, air = g.z > 1;
    fyShadow(c, px, py, air ? 8 : 12, air ? 0.16 : 0.3);
    fyBlit(c, sprGriffin(air || g.st === 'duel' ? (Math.floor(g.ph * 4) & 1) : 1), px, py - g.z, g.face, 1, 1, 0.8);
  }]);
}

// ---------- Саламандра ----------
function salamanderTick(dt, F) {
  F.sT = (F.sT || 0) - dt;
  if (F.sT <= 0) {
    F.sT = 6;
    for (const b of Game.buildings) {
      if (b.state !== 'done' || b.removed || F.salChk.has(b.id) || !['metallurgist', 'smeltery', 'weaponsmith'].includes(b.type)) continue;
      F.salChk.add(b.id);
      if (Math.random() < 0.55) F.sal.push({ bid: b.id, acc: 0, was: false, ph: Math.random() * 9, bright: 0 });
    }
  }
  for (let i = F.sal.length - 1; i >= 0; i--) {
    const s = F.sal[i], b = fyBuilding(s.bid);
    if (!b) { F.sal.splice(i, 1); continue; }
    s.ph += dt;
    const on = !!b.working;
    s.bright += ((on ? 1 : 0.25) - s.bright) * Math.min(1, dt * 2);
    if (on) {
      // рецепт идёт ~на 10% быстрее: накопили 10 рабочих долей — получаем лишнюю порцию
      const rs = b.def.recipes, r = rs && rs[(b.recipeIdx + rs.length - 1) % rs.length];
      if (r) {
        s.acc += dt;
        if (s.acc >= r.time * 10) {
          s.acc = 0;
          const g = Object.keys(r.out)[0];
          if (b.stock[g] + r.out[g] <= b.def.outputs[g]) { b.stock[g] += r.out[g]; Game.produced[g] += r.out[g]; floater(b.doorX + 0.5, b.doorY - 0.4, 'Ф-ф-фых!', '#ffb060'); fstat('salBoost'); logEvent('gold', `Саламандра раздула огонь: ${b.def.name.toLowerCase()} сделала лишнее`, b.doorX, b.doorY); }
        }
      }
      if (!s.was) { s.was = true; if (Math.random() < 0.5) floater(b.doorX + 1.3, b.doorY, 'Ш-ш…', '#ff9a50'); }
    } else s.was = false;
  }
}

function salamanderDraw(list, c, F, x0, y0, x1, y1) {
  for (const s of F.sal) {
    const b = fyBuilding(s.bid);
    if (!b || !FY_SEE(b.doorX, b.doorY, x0, y0, x1, y1)) continue;
    const sx = b.doorX + 0.5 + (b.rot === 2 ? -1.1 : 1.1), sy = b.doorY + 0.55;
    list.push([sy + 0.1, () => {
      const px = sx * TILE, py = sy * TILE + 3, k = s.bright, fl = 0.75 + Math.sin(s.ph * 11) * 0.12 + Math.sin(s.ph * 17) * 0.08;
      c.save(); c.globalCompositeOperation = 'lighter';
      const gr = c.createRadialGradient(px, py - 4, 1, px, py - 4, 16 + 14 * k);
      gr.addColorStop(0, `rgba(255,150,40,${(0.18 + 0.4 * k) * fl})`); gr.addColorStop(1, 'rgba(255,100,20,0)');
      c.fillStyle = gr; c.fillRect(px - 34, py - 38, 68, 68);
      c.restore();
      fyBlit(c, sprSalamander(k > 0.6 ? (Math.floor(s.ph * 6) & 1) : 0), px, py, 1, 1);
      if (k > 0.6 && (Math.floor(s.ph * 8) & 3) === 0) { c.fillStyle = '#ffd860'; c.fillRect(Math.round(px - 5 + Math.sin(s.ph * 9) * 5), Math.round(py - 12 - (s.ph * 14) % 8), 1, 2); }
    }]);
  }
}

// ---------- Золотая рыбка ----------
let lastFishToast = -99;
function fishTick(dt, F) {
  let f = F.fish;
  if (!f) {
    F.fT = (F.fT || 0) - dt;
    if (F.fT > 0) return;
    F.fT = 30;
    if (nightAmt() > 0.1 || isRaining() || Math.random() > 0.07) return;
    const cx = MAP_W >> 1, cy = MAP_H >> 1;
    for (let t = 0; t < 300; t++) {
      const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
      if (!fyIsWater(x, y) || Math.hypot(x - cx, y - cy) > 34) continue;
      let shore = false;
      for (const [ax, ay] of DIRS) { const sx = x + ax, sy = y + ay; if (inb(sx, sy) && !fyIsWater(sx, sy) && isWalkable(sx, sy)) shore = true; }
      if (!shore) continue;
      F.fish = f = { x: x + 0.5, y: y + 0.5, ax: x + 0.5, ay: y + 0.5, tx: x + 0.5, ty: y + 0.5, face: 1, ph: 0, life: 240, st: 'swim', jt: 0 };
      logEvent('animal', 'В озере мелькнула золотая рыбка', f.x, f.y); fstat('fishSeen');
      if (Game.time - lastFishToast > 200) { lastFishToast = Game.time; toast('В озере плещется золотая рыбка — герой может её поймать'); }
      return;
    }
    return;
  }
  f.ph += dt;
  if (f.st === 'caught') { f.jt -= dt; if (f.jt <= 0) F.fish = null; return; }
  f.life -= dt;
  if (f.life <= 0) { F.fish = null; return; }
  if (Math.hypot(f.tx - f.x, f.ty - f.y) < 0.15) {
    for (let t = 0; t < 8; t++) {
      const x = f.ax + fyR(-2.5, 2.5), y = f.ay + fyR(-2.5, 2.5);
      if (fyIsWater(x | 0, y | 0)) { f.tx = x; f.ty = y; break; }
    }
  } else {
    const ox = f.x, oy = f.y; fyMove(f, f.tx, f.ty, 1.2, dt);
    if (!fyIsWater(f.x | 0, f.y | 0)) { f.x = ox; f.y = oy; f.tx = f.x; f.ty = f.y; }
  }
  if (Math.floor(f.ph) % 7 === 3 && f.jt <= 0) { f.jt = 0.6; fxBurst(f.x * TILE, f.y * TILE, 6, ['#d8f0ff', '#ffffff'], 30, 40, 0.5, 1.2, 160); }
  else f.jt = Math.max(0, f.jt - dt);
  // герой на берегу
  const hero = fyHero();
  if (hero && Math.hypot(hero.x - f.x, hero.y - f.y) < 3.2) {
    f.st = 'caught'; f.jt = 2;
    const n = 4 + (Math.random() * 5 | 0);
    floater(f.x, f.y - 1.4, 'Отпусти — откуплюсь!', '#fff2a0');
    const s = randomFreeNear(Math.floor(hero.x), Math.floor(hero.y), 0, 2, (x, y) => isWalkable(x, y)) || [Math.floor(hero.x), Math.floor(hero.y)];
    dropPile(s[0], s[1], 'gold', n);
    fstat('fishCaught'); fstat('fishGold', n);
    logEvent('gold', `Герой поймал золотую рыбку и получил выкуп: золото ×${n}`, f.x, f.y);
    toast(`Герой поймал золотую рыбку! Выкуп: золото ×${n}`);
    fxBurst(f.x * TILE, f.y * TILE, 16, ['#fff2a0', '#ffd700', '#ffffff'], 80, 70, 0.8, 1.6, 200);
  }
}
function fishDraw(list, c, F, x0, y0, x1, y1) {
  const f = F.fish;
  if (!f || !FY_SEE(f.x, f.y, x0, y0, x1, y1)) return;
  list.push([f.y, () => {
    const px = f.x * TILE, py = f.y * TILE + 2, up = f.st === 'caught' ? Math.sin(Math.min(1, (2 - f.jt) / 1.2) * Math.PI) * 14 : (f.jt > 0 ? Math.sin(f.jt / 0.6 * Math.PI) * 6 : 0);
    c.strokeStyle = 'rgba(220,240,255,0.45)'; c.beginPath(); c.ellipse(px, py + 2, 9 + (f.ph * 4) % 4, 3 + ((f.ph * 4) % 4) * 0.3, 0, 0, 7); c.stroke();
    fyBlit(c, sprFish(Math.floor(f.ph * 6) & 1), px, py - up + 3, f.face, f.st === 'caught' ? Math.max(0, f.jt / 1) : 0.92);
  }]);
}

// ---------- Золотой гусь ----------
function goldGooseTick(dt, F) {
  let g = F.gg;
  const geese = Game.animals.filter(a => a.kind === 'goose' && !a.dead);
  if (!g) {
    F.gT = (F.gT || 0) - dt;
    if (F.gT > 0) return;
    F.gT = 20;
    if (!geese.length || (F.ggSaved == null && Math.random() > 0.03)) return;
    const a = geese[(Math.random() * geese.length) | 0];
    F.gg = g = { x: a.x + 0.5, y: a.y + 0.5, face: 1, ph: 0, mv: false, a, egg: F.ggSaved != null ? F.ggSaved : -1, upset: -1, wait: 3 };
    F.ggSaved = null;
    logEvent('animal', 'Среди гусей замечен золотой гусь', g.x, g.y); fstat('ggSeen');
    toast('Среди гусей ходит золотой гусь — не обижайте стаю, и он будет нести золотые яйца');
    return;
  }
  g.ph += dt;
  if (!g.a || g.a.dead || !Game.animals.includes(g.a)) {
    g.a = geese[0];
    if (!g.a) { F.gg = null; return; }
  }
  const k = fyDay();
  // обидели стаю: кто-то из гусей убегает/прогнан или трое гномов рядом
  if (g.a.state === 'shoo' || g.a.shooUntil > Game.time) { if (g.upset !== k) { g.upset = k; floater(g.x, g.y - 1.6, 'Га-а!', '#ffd0a0'); logEvent('animal', 'Золотого гуся обидели — яйца сегодня не будет', g.x, g.y); } }
  const ox = g.x, oy = g.y, d = Math.hypot(g.a.x - g.x, g.a.y - g.y);
  g.mv = false;
  if (d > 1.6) {
    fyMove(g, g.a.x, g.a.y, Math.min(2.6, 1 + d * 0.5), dt);
    if (!gooseCanBe(g.x | 0, g.y | 0)) { g.x = ox; g.y = oy; } else g.mv = true;
  }
  if (g.egg !== k && g.upset !== k) {
    g.wait -= dt;
    if (g.wait <= 0 && !g.mv && nightAmt() < 0.5) {
      g.egg = k; g.wait = 3;
      dropPile(Math.floor(g.x), Math.floor(g.y), 'gold', 2);
      floater(g.x, g.y - 1.4, 'Блям!', '#ffd700'); fstat('goldEgg');
      logEvent('gold', 'Золотой гусь снёс золотое яйцо (золото ×2)', g.x, g.y);
      fxBurst(g.x * TILE, g.y * TILE - 6, 10, ['#fff2a0', '#ffd700'], 40, 40, 0.7, 1.4, 200);
    }
  }
}
function goldGooseDraw(list, c, F, x0, y0, x1, y1) {
  const g = F.gg;
  if (!g || !FY_SEE(g.x, g.y, x0, y0, x1, y1)) return;
  list.push([g.y + 0.15, () => {
    const px = g.x * TILE, py = g.y * TILE + 4;
    fyShadow(c, px, py, 8);
    fyBlit(c, sprGoose(g.mv ? (Math.floor(g.ph * 6) & 1) : 0), px, py, g.face, 1, 1, 0.9);
    if ((Math.floor(g.ph * 6) % 5) === 0) { c.fillStyle = '#fffbd0'; c.fillRect(Math.round(px + Math.sin(g.ph * 5) * 8), Math.round(py - 12 + Math.cos(g.ph * 3) * 5), 1, 1); }
  }]);
}

// ---------- Общий тик и рисование ----------
function fairyTick(dt) {
  if (!FAUNA_ON() || !Game.buildings || !Game.buildings.length) return;
  const F = fyState();
  fyNests(F);
  brownieTick(dt, F);
  unicornTick(dt, F);
  dragonTick(dt, F);
  griffinTick(dt, F);
  salamanderTick(dt, F);
  fishTick(dt, F);
  goldGooseTick(dt, F);
}

function fairyDrawList(list, c, x0, y0, x1, y1) {
  if (!FAUNA_ON() || !Game.fairy) return;
  const F = Game.fairy;
  brownieDraw(list, c, F, x0, y0, x1, y1);
  unicornDraw(list, c, F, x0, y0, x1, y1);
  dragonDraw(list, c, F, x0, y0, x1, y1);
  griffinDraw(list, c, F, x0, y0, x1, y1);
  salamanderDraw(list, c, F, x0, y0, x1, y1);
  fishDraw(list, c, F, x0, y0, x1, y1);
  goldGooseDraw(list, c, F, x0, y0, x1, y1);
}

// ---------- Сохранение ----------
function serializeFairy1() {
  const F = Game.fairy;
  if (!F) return undefined;
  const o = {
    b: F.bw.map(b => [b.bid, b.milk, b.dec, b.prank]), bc: [...F.chk],
    s: F.sal.map(s => s.bid), sc: [...F.salChk],
  };
  if (F.dr) o.d = [F.dr.nx, F.dr.ny, F.dr.tamed ? 1 : 0];
  if (F.gr) o.g = [F.gr.nx, F.gr.ny, F.gr.tr, F.gr.st === 'gone' ? Math.round(F.gr.resp) : 0];
  if (F.gg) o.e = F.gg.egg;
  return o;
}
function loadFairy1(o) {
  Game.fairy = null;
  if (!o) return;
  const F = fyState();
  for (const [bid, milk, dec, prank] of o.b || []) F.bw.push({ bid, milk, dec, prank, logK: -1, tt: 0, act: 15, pk: 0, nextPk: fyR(30, 90), ph: Math.random() * 9 });
  for (const id of o.bc || []) F.chk.add(id);
  for (const bid of o.s || []) F.sal.push({ bid, acc: 0, was: false, ph: Math.random() * 9, bright: 0 });
  for (const id of o.sc || []) F.salChk.add(id);
  if (o.d) F.drSaved = o.d;
  if (o.g) F.grSaved = o.g;
  if (o.e != null) F.ggSaved = o.e;
}
