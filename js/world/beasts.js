'use strict';
// Обычное зверьё в придачу к fauna.js / fauna2.js:
//  • кабан бродит по лесу, роет жёлуди и грибы, на гнома бросается и кусает (хромота); герой и толпа гномов отгоняют, герой может завалить — шкуры и мясо;
//  • медведь тянется к ульям за мёдом (пчёл не боится), опасен для всякого, кто подойдёт; отгоняют только вчетвером, героя он ломает, но герой его способен одолеть;
//  • коты четырёх окрасов (рыжий, серый полосатый, чёрный, белый в пятнах) селятся у склада и пекарни, ловят мышей из Game.mice, приручаются едой, мурлычут;
//  • аист вьёт гнездо на высокой крыше у воды и таскает из озера рыбу, цапля стоит на мелководье, ловит рыбу и крадёт улов у удильщиков;
//  • пчёлы вьются у ульев днём (ульи сами появляются возле ферм), мёд собирают гномы мимоходом — итог идёт в faunaStat.honey;
//  • рыба видна в озёрах: тень под водой, иногда выпрыгивает с блеском и всплеском;
//  • стая ворон кружит над созревшим полем, садится и клюёт; пугало, герой или трое гномов её прогоняют.
// Звуков тут нет: только всплывающие надписи «Мяу!», «Хрю!», «Р-р!», «Жжж…» (озвучит отдельная работа).
// Итоги пишутся в Game.faunaStat, в сохранение идут ульи, коты и гнездо аиста (поле be).

const BE_PAL = {
  k: '#1c1a20', K: '#3a3640', w: '#f4f2ea', W: '#d8d4c6', e: '#e8e2c4',
  n: '#5a4636', N: '#2e2420', g: '#7a6450', s: '#c09484', S: '#98685c',
  q: '#6a4428', Q: '#3e2616', l: '#8a6040', m: '#b8946a', z: '#14100c',
  r: '#d03a2c', R: '#a82820', y: '#e0b438', Y: '#a8802c', d: '#6a4a20', t: '#7a5a34',
  b: '#4a7a9a', B: '#2e5470', i: '#b8d0dc', h: '#8a98a8', H: '#5a6878', c: '#d8c8a0',
};
const BE_CACHE = {};
const beSpr = (key, rows, pal = BE_PAL) => BE_CACHE[key] || (BE_CACHE[key] = faSprite(rows, pal));

function beDraw(c, key, rows, x, y, face = 1, lift = 0, shadow = true, pal = BE_PAL) {
  const spr = beSpr(key, rows, pal), w = spr.width, h = spr.height;
  if (shadow) { c.fillStyle = 'rgba(10,8,4,0.28)'; c.beginPath(); c.ellipse(x, y, Math.max(3, w * 0.4), Math.max(1.6, w * 0.1), 0, 0, 7); c.fill(); }
  c.imageSmoothingEnabled = false;
  c.save(); c.translate(Math.round(x), Math.round(y - h - lift + 1));
  if (face < 0) c.scale(-1, 1);
  c.drawImage(spr, -Math.round(w / 2), 0);
  c.restore();
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Карты спрайтов (лицом вправо) ----------
const BOAR_A = [
  '...N.N.N.N..........',
  '..nNnNnNnnn.....nn..',
  '.nnnnnnnnnnnnnnnnnn.',
  'nnnnnnnnnnnnnnnnknns',
  'nnnnnnnnnnnnnnnnnnss',
  'nnnnnnnnnnnnnnnngsse',
  '.nnnnnnnnnnnnnnnnsse',
  '.NNNNNNNNNNNNNNNNN..',
  '..n.n........n.n....',
  '..N.N........N.N....',
];
const BOAR_B = BOAR_A.slice(0, 8).concat(['...n.n......n.n.....', '...N.N......N.N.....']);
const BOAR_ROOT = [
  '....N.N.N.N.........',
  '...nNnNnNnnn........',
  '..nnnnnnnnnnnnn.....',
  '.nnnnnnnnnnnnnnnn...',
  'nnnnnnnnnnnnnnnnnn..',
  'nnnnnnnnnnnnnnnnnnn.',
  '.nnnnnnnnnnnnnnnknsS',
  '.NNNNNNNNNNNNNNgssse',
  '..n.n........n.nnsse',
  '..N.N........N.N....',
];
const BEAR_A = [
  '........qqqq............',
  '......qqqqqqqq......qq.q',
  '....qqqqqqqqqqq...qqqqqq',
  '...qqqqqqqqqqqqqqqqqqqqq',
  '..qqqqqqqqqqqqqqqqqqkqqq',
  '..qqqqqqqqqqqqqqqqqqqmmm',
  '..qqqqqqqqqqqqqqqqqqmmzm',
  '..qqqqqqqqqqqqqqqqqqqmmm',
  '..QqqqqqqqqqqqqqqqqqqQQQ',
  '...QQQQQQQQQQQQQQQQQQQ..',
  '...qqq..qqq......qqq.qq.',
  '...qqq..qqq......qqq.qq.',
  '...QQQ..QQQ......QQQ.QQ.',
];
const BEAR_B = BEAR_A.slice(0, 10).concat(['....qqq.qqq.....qqq.qq..', '....qqq.qqq.....qqq.qq..', '....QQQ.QQQ.....QQQ.QQ..']);
const BEAR_EAT = [
  '........qqqq............',
  '......qqqqqqqq.......qq.',
  '....qqqqqqqqqqq....qqqqq',
  '...qqqqqqqqqqqqqqqqqqqqq',
  '..qqqqqqqqqqqqqqqqqqqqqq',
  '..qqqqqqqqqqqqqqqqqqkqmm',
  '..qqqqqqqqqqqqqqqqqqqmzm',
  '..qqqqqqqqqqqqqqqqqqqymm',
  '..QqqqqqqqqqqqqqqqqqqYym',
  '...QQQQQQQQQQQQQQQQQQQ..',
  '...qqq..qqq......qqq.qq.',
  '...qqq..qqq......qqq.qq.',
  '...QQQ..QQQ......QQQ.QQ.',
];

// Коты: a — основной цвет, b — тёмный, c — светлый, x — полосы/пятна, e — глаза, p — нос
const CAT_VARS = [
  { n: 'рыжий',            pal: { a: '#d0803a', b: '#8a4a1c', c: '#f2cc98', x: '#a85c24', e: '#e8e050', p: '#e89a9a' } },
  { n: 'серый полосатый',  pal: { a: '#8c8c96', b: '#46464e', c: '#cacad2', x: '#4c4c56', e: '#d8e050', p: '#e8a0a8' } },
  { n: 'чёрный',           pal: { a: '#2a2830', b: '#121016', c: '#4a4854', x: '#35333c', e: '#f0d838', p: '#a86a72' } },
  { n: 'белый в пятнах',   pal: { a: '#f2eee2', b: '#6a5a4a', c: '#ffffff', x: '#7a5a3c', e: '#78b8e0', p: '#e8a0a0' } },
];
const CAT_SIT = [
  '.......a.a.',
  '......aaaaa',
  '......aeaea',
  '......aapaa',
  '.....axaaa.',
  '....axaaaa.',
  '...axaaaca.',
  '...aaaaacc.',
  '..axaaaaca.',
  '.aaxaaaaaa.',
  'aaaaaaaaaa.',
];
const CAT_WALK_A = [
  '...........a.a',
  '.........aaaaa',
  '.........aeaea',
  '.a.......aapaa',
  '.a..aaaaaaaaa.',
  '.aaaaaxaaxaaa.',
  '..aaaaaaaacaa.',
  '..a.a......a.a',
  '..b.b......b.b',
];
const CAT_WALK_B = CAT_WALK_A.slice(0, 7).concat(['...a.a....a.a.', '...b.b....b.b.']);
const CAT_SLEEP = [
  '...aaaaaa..',
  '..aaxaaxaaa',
  '.aaaaaaaaaa',
  'baaaaaaacep',
  '.baaaaaaab.',
];

const STORK_S = [
  '.......wwww.....',
  '.......wwkwrrrrr',
  '.......wwwwR....',
  '........ww......',
  '........ww......',
  '.......www......',
  '....wwwwwww.....',
  '..wwwwwwwwww....',
  'kkkwwwwwwwwww...',
  '.kkkwwwwwwww....',
  '..kkwwwwwwww....',
  '...wwwwwwww.....',
  '.....wwww.......',
  '.....R..R.......',
  '.....R..R.......',
  '.....R..R.......',
  '.....R..R.......',
  '.....R..R.......',
  '....RR..RR......',
];
const HERON_S = [
  '.....hh....',
  '....hhkhyyyy',
  '....HhhhY...',
  '.....ww.....',
  '.....ww.....',
  '....www.....',
  '....wwww....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..HhhhhhhH..',
  '...HhhhhH...',
  '....hhhh....',
  '.....Y.Y....',
  '.....Y.Y....',
  '.....Y.Y....',
  '.....Y.Y....',
  '.....Y.Y....',
  '.....Y.Y....',
  '....YY.YY...',
];
const HERON_STRIKE = [
  '............',
  '............',
  '............',
  '...hh.......',
  '...hhh......',
  '....hhw.....',
  '....hhww....',
  '...hhhhhh...',
  '..hhhhhhhhk.',
  '..HhhhhhhhhY',
  '...HhhhhH..Y',
  '....hhhh...Y',
  '.....Y.Y...y',
  '.....Y.Y....',
  '.....Y.Y....',
  '.....Y.Y....',
  '.....Y.Y....',
  '.....Y.Y....',
  '....YY.YY...',
];
const BEE_HIVE = [
  '.....yy.....',
  '....yyyy....',
  '...yYyyYy...',
  '...yyyyyy...',
  '..yYyyyyYy..',
  '..yyyyyyyy..',
  '.yYyyyyyyYy.',
  '.yyyykkyyyy.',
  '.YyyykkyyyY.',
  '.dddddddddd.',
  '..t......t..',
  '..t......t..',
];
const BE_FISH = [
  '....bbb...',
  '.r.bbbbbb.',
  'rrbsssssbk',
  '.r.sssssw.',
  '....ww....',
];

// Птица в полёте: тело, шея с клювом, ноги назад и крыло в трёх положениях. Строится из пикселей
function beFlySprite(key, o, frame) {
  const k = key + frame;
  if (BE_CACHE[k]) return BE_CACHE[k];
  const W = 30, H = 20, cv = mkCanvas(W, H), c = cv.getContext('2d');
  const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };
  const inPoly = (pts, x, y) => {
    let r = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) r = !r;
    }
    return r;
  };
  const poly = (pts, col, tipCol) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inPoly(pts, x + 0.5, y + 0.5)) px(x, y, tipCol && x < 7 ? tipCol : col); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                      // тело
    const ex = (x - 12) / 6, ey = (y - 10) / 2.4;
    if (ex * ex + ey * ey <= 1) px(x, y, ey > 0.3 ? o.belly : o.body);
  }
  for (let t = 0; t < 7; t++) px(17 + t, 9 - Math.round(t * 0.35), o.neck);       // шея
  for (let x = 24; x < 24 + o.beak; x++) px(x, 7, o.bill);                        // клюв
  px(23, 7, o.body); px(23, 6, o.body); px(24, 6, o.body); px(24, 6, o.eye);
  for (let t = 0; t < 6; t++) px(5 - t, 11 + (t > 2 ? 1 : 0), o.leg);              // ноги за хвост
  const wing = flapPose([[9, 9], [17, 9], [16, 1], [3, 3]], [[8, 9], [17, 9], [17, 7], [2, 7]], [[9, 11], [16, 11], [14, 19], [5, 18]], frame, 8);   // 8 кадров взмаха
  poly(wing, o.wing, o.tip);
  cv.beFace = 1;
  return BE_CACHE[k] = cv;
}
const BE_STORK_FLY = { body: '#f4f2ea', belly: '#d8d4c6', neck: '#f4f2ea', bill: '#d03a2c', eye: '#1c1a20', leg: '#d03a2c', wing: '#f4f2ea', tip: '#1c1a20', beak: 5 };
const BE_HERON_FLY = { body: '#8a98a8', belly: '#6a7888', neck: '#d8e0e8', bill: '#e0b438', eye: '#1c1a20', leg: '#e0b438', wing: '#8a98a8', tip: '#3a4452', beak: 4 };

// ---------- Общие помощники ----------
function beStep(o, tx, ty, sp, dt, can) {
  const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
  if (d < 0.06) { o.moving = false; return true; }
  const s = Math.min(d, sp * dt), nx = o.x + dx / d * s, ny = o.y + dy / d * s;
  if (!can(Math.floor(nx), Math.floor(ny))) { o.moving = false; return false; }
  o.x = nx; o.y = ny; o.moving = true; o.ph = (o.ph || 0) + s * 5;
  if (Math.abs(dx) > 0.01) o.face = dx > 0 ? 1 : -1;
  return s >= d;
}
const beLand = (x, y) => inb(x, y) && !World.bmap[idx(x, y)] && World.terrain[idx(x, y)] !== T_ROCK && World.terrain[idx(x, y)] !== T_WATER;
const beShore = (x, y) => inb(x, y) && !World.bmap[idx(x, y)] && (World.terrain[idx(x, y)] === T_WATER || World.terrain[idx(x, y)] === T_SAND);
const beDone = () => Game.buildings.filter(b => b.state === 'done' && !b.removed).length;
const beDay = () => nightAmt() < 0.45 && !isRaining();
const beHero = () => Game.hero && !Game.hero.dead && !Game.hero.inside ? Game.hero : null;
let beLast = {};
const beOnce = (k, gap) => { if (Game.time - (beLast[k] ?? -9999) < gap) return false; beLast[k] = Game.time; return true; };

function beDirt(o, n = 1) {
  for (let i = 0; i < n; i++) (Game.dirt || (Game.dirt = [])).push({ x: o.x + o.face * 0.5, y: o.y, vx: (Math.random() - 0.5) * 1.4, vy: -1.6 - Math.random(), z: 0.3, t: 0 });
}

// Герой, стоя вплотную, бьёт зверя: возвращает true, когда зверь добит. Зверь в ответ кусает героя
function beHeroFight(o, dt, reach, rate) {
  const h = beHero();
  if (!h || Math.hypot(h.x - o.x, h.y - o.y) > reach) return false;
  o.hp -= dt * rate;
  h.gest = 'fist'; h.gestUntil = Game.time + 0.6; h.gestFace = o.x > h.x ? 1 : -1;
  return o.hp <= 0;
}

function beLoot(o, hides, meat) {
  const x = Math.floor(o.x), y = Math.floor(o.y);
  if (hides) dropPile(x, y, 'hide', hides);
  if (meat) dropPile(x, y, 'steak', meat);
}

// ---------- Кабан ----------
function beBoarsTick(dt) {
  const bo = Game.boars || (Game.boars = []);
  Game.boarT = (Game.boarT ?? 30) - dt;
  if (Game.boarT <= 0) {
    Game.boarT = 45 + Math.random() * 60;
    if (bo.length < (N_TILES > 9000 ? 3 : 2) && beDone() >= 2) {
      const s = wildSpot(18);
      if (s) bo.push({ x: s[0] + 0.5, y: s[1] + 0.5, home: s, state: 'forage', t: 1, face: 1, ph: 0, moving: false, hp: 3, cd: 0, go: null, root: 0, sc: 0 });
    }
  }
  for (let i = bo.length - 1; i >= 0; i--) {
    const b = bo[i];
    b.t -= dt; b.cd -= dt; b.sc -= dt;
    if (b.state !== 'flee' || b.hp < 3) if (beHeroFight(b, dt, 1.5, 1.1)) {
      beLoot(b, 2, 1 + (Math.random() < 0.5 ? 1 : 0));
      floater(b.x, b.y - 1, 'Хрясь!', '#ffe0c0'); fstat('boarKill');
      logEvent('animal', 'Герой одолел кабана: добыча — шкуры и мясо', b.x, b.y);
      toast('Кабан повержен! Шкуры и мясо остались на земле');
      bo.splice(i, 1); continue;
    }
    if (b.sc <= 0 && b.state !== 'flee') {
      b.sc = 0.3;
      const s = shooersNear(b.x, b.y, 4, 3, 1.9);                    // героя кабан боится меньше: отступает лишь вплотную
      if (s) { shooWave(s, 'Кыш!'); floater(b.x, b.y - 1, 'Хрю!', '#e8d8c8'); if (beOnce('boarShooStat', 25)) fstat('boarShoo'); b.state = 'flee'; b.t = 7; b.go = null; }
      else if (b.cd <= 0) {
        const p = nearestPerson(b, 3.2, u => isPerson(u) && u.type !== 'carter' && !u.dead && u.type !== 'hero');
        if (p) { b.state = 'charge'; b.tgt = p; b.t = 7; floater(b.x, b.y - 1, 'Хрю!', '#e8d8c8'); }
      }
    }
    if (b.state === 'flee') {
      const dx = b.x - b.home[0], dy = b.y - b.home[1];
      beStep(b, b.home[0] + 0.5, b.home[1] + 0.5, 3, dt, beLand);
      if (b.t <= 0 || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) { b.state = 'forage'; b.t = 2; b.moving = false; }
    } else if (b.state === 'charge') {
      const p = b.tgt;
      if (!p || p.inside || p.dead || b.t <= 0) { b.state = 'forage'; b.t = 2; b.cd = 8; b.moving = false; continue; }
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d > 0.7) beStep(b, p.x, p.y, 3.1, dt, (x, y) => inb(x, y) && World.terrain[idx(x, y)] !== T_ROCK && World.terrain[idx(x, y)] !== T_WATER);
      else {
        p.ouchUntil = Game.time + 2; floater(p.x, p.y - 1.4, 'Ай!', '#ffc8a0');
        if (!p.injury && Math.random() < 0.7) { injure(p, 'leg'); p.injuryUntil = Game.time + 40; }
        fstat('boarBite');
        logEvent('animal', 'Кабан напал на гнома и укусил', p.x, p.y);
        if (beOnce('boarToast', 120)) toast('Кабан напал на гнома! Нужен герой или трое гномов вместе');
        b.state = 'flee'; b.t = 6; b.cd = 25; b.moving = false;
      }
    } else {                                                          // ищет жёлуди и грибы
      if (b.root > 0) {
        b.root -= dt; b.moving = false;
        if (Math.random() < dt * 5) beDirt(b);
        if (b.root <= 0) {
          fstat('boarForage');
          if (Math.random() < 0.3) floater(b.x, b.y - 0.8, 'Хрю!', '#e8d8c8');
          if (beOnce('boarLog', 400)) logEvent('animal', 'Кабан роет лесную подстилку: жёлуди и грибы', b.x, b.y);
        }
      } else if (b.go) {
        if (beStep(b, b.go[0], b.go[1], 0.9, dt, beLand)) { b.go = null; b.root = 4 + Math.random() * 4; b.moving = false; }
        else if (!b.moving) b.go = null;
      } else if (b.t <= 0) {
        b.t = 1 + Math.random() * 3;
        const tr = treeSpot(b.home[0], b.home[1], 8);
        if (tr) b.go = [tr[0] + 0.5, tr[1] + 1.0];
      }
    }
  }
}
function beDrawBoar(c, b) {
  const px = b.x * TILE, py = b.y * TILE + 4;
  if (b.root > 0) beDraw(c, 'boarR', BOAR_ROOT, px, py, b.face);
  else if (b.moving) { const i = Math.floor(b.ph * 0.6 * 4) % 8; beDraw(c, 'boarW' + i, gaitRows(BOAR_A, 2, 8, i), px, py, b.face); }   // 8 кадров шага
  else beDraw(c, 'boarA', BOAR_A, px, py, b.face);
}

// ---------- Мёд, ульи и пчёлы ----------
function beHivesTick(dt) {
  const hv = Game.hives || (Game.hives = []);
  const day = beDay();
  Game.hvT = (Game.hvT || 0) - dt;
  if (Game.hvT <= 0) {
    Game.hvT = 25;
    const farms = Game.buildings.filter(b => b.type === 'farm' && b.state === 'done' && !b.removed).length;
    const want = farms ? Math.min(3, 1 + (farms > 1 ? 1 : 0) + (farms > 3 ? 1 : 0)) : 0;
    if (hv.length < want) {
      for (let k = 0; k < 60; k++) {
        const i = (Math.random() * N_TILES) | 0, o = World.obj[i];
        if (!o || o.t !== 'field' || o.plan || !o.farm) continue;
        const s = randomFreeNear(i % MAP_W, (i / MAP_W) | 0, 2, 4, (x, y) => isFreeGrass(x, y) && !World.road[idx(x, y)] && !World.bmap[idx(x, y)] && !World.obj[idx(x, y)] && !hv.some(h => Math.hypot(h.x - x - 0.5, h.y - y - 0.5) < 5));
        if (!s) continue;
        hv.push(beNewHive(s[0] + 0.5, s[1] + 0.5, 0));
        fstat('hive'); logEvent('animal', 'У полей поставили улей: пчёлы опыляют посевы', s[0], s[1]);
        if (beOnce('hiveToast', 300)) toast('У фермы появился улей — гномы будут собирать мёд');
        break;
      }
    }
  }
  for (let i = hv.length - 1; i >= 0; i--) {
    const h = hv[i];
    if (!inb(Math.floor(h.x), Math.floor(h.y)) || World.bmap[idx(Math.floor(h.x), Math.floor(h.y))]) { hv.splice(i, 1); continue; }
    if (day) {
      h.acc += dt;
      if (h.acc > 55 && h.honey < 4) { h.acc = 0; h.honey++; }
      for (const b of h.bees) {                                       // облёт: вокруг улья или к цветам и обратно
        b.t -= dt;
        const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
        if (d > 0.12) { const s = Math.min(d, 2.2 * dt); b.x += dx / d * s; b.y += dy / d * s; }
        else if (b.t <= 0) {
          if (Math.random() < 0.45) { const a = Math.random() * 6.28, r = 3 + Math.random() * 3; b.tx = h.x + Math.cos(a) * r; b.ty = h.y + Math.sin(a) * r * 0.7; b.t = 1.5 + Math.random() * 2; }
          else { const a = Math.random() * 6.28, r = 0.4 + Math.random() * 0.7; b.tx = h.x + Math.cos(a) * r; b.ty = h.y - 0.4 + Math.sin(a) * r * 0.6; b.t = 0.5 + Math.random(); }
        }
      }
    }
    h.sc = (h.sc || 0) - dt;
    if (h.sc <= 0) {
      h.sc = 0.8;
      const p = nearestPerson(h, 1.8, u => isPerson(u) && u.type !== 'carter' && !u.dead);
      if (p && day) {
        if (beOnce('buzz' + i, 14)) floater(h.x, h.y - 1.2, 'Жжж…', '#f0e090');
        if (h.honey >= 2) {
          fstat('honey', h.honey);
          floater(p.x, p.y - 1.3, `+${h.honey} мёда`, '#ffd860');
          if (beOnce('honeyLog', 90)) logEvent('animal', `Гном собрал мёд с улья: ${h.honey} горшочк.`, h.x, h.y);
          h.honey = 0;
          if (Math.random() < 0.15) { floater(p.x, p.y - 1.7, 'Ай, пчела!', '#ffc8a0'); }
        }
      }
    }
  }
}
function beNewHive(x, y, honey) {
  const bees = [];
  for (let k = 0; k < 5; k++) bees.push({ x: x + (Math.random() - 0.5), y: y - 0.4, tx: x, ty: y - 0.4, t: Math.random() * 2, ph: Math.random() * 9 });
  return { x, y, honey, acc: Math.random() * 40, bees, raid: -999, sc: 0 };
}
function beDrawHive(c, h) {
  const px = h.x * TILE, py = h.y * TILE + 6;
  beDraw(c, 'hive', BEE_HIVE, px, py, 1, 0, true);
  if (h.honey >= 2) { c.fillStyle = '#ffe070'; c.fillRect(Math.round(px) + 4, Math.round(py) - 8, 2, 2); }       // капля мёда
}
function beDrawBees(c, h) {
  if (!beDay()) return;
  for (const b of h.bees) {
    const x = Math.round(b.x * TILE + Math.sin(Game.time * 14 + b.ph) * 2), y = Math.round(b.y * TILE - 6 + Math.cos(Game.time * 11 + b.ph) * 2);
    c.fillStyle = '#2a2010'; c.fillRect(x, y, 3, 2);
    c.fillStyle = '#f0c030'; c.fillRect(x + 1, y, 1, 2);
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(x, y - 1, 1, 1); c.fillRect(x + 2, y - ((Math.floor(Game.time * 25 + b.ph) & 1) ? 1 : 0), 1, 1);
  }
}

// ---------- Медведь ----------
function beBearTick(dt) {
  let bd = Game.bear;
  if (!bd) bd = Game.bear = { state: 'away', t: 120 + Math.random() * 120, x: 0, y: 0, face: 1, ph: 0, moving: false, hp: 8, cd: 0 };
  if (bd.state === 'away') {
    bd.t -= dt;
    if (bd.t > 0 || beDone() < 3) return;
    const s = wildSpot(20);
    if (!s) { bd.t = 40; return; }
    Object.assign(bd, { state: 'roam', x: s[0] + 0.5, y: s[1] + 0.5, home: s, path: null, hp: 8, cd: 0, life: 260 + Math.random() * 200, t: 2, sc: 0, eat: 0, hive: null, moving: false });
    if (beOnce('bearLog', 600)) logEvent('animal', 'В лесу видели медведя: пасеки теперь не безопасны', s[0], s[1]);
    return;
  }
  bd.ph += dt * 3; bd.cd -= dt; bd.t -= dt; bd.life -= dt; bd.sc -= dt;
  if (beHeroFight(bd, dt, 1.7, 1)) {
    beLoot(bd, 3, 3); fstat('bearKill');
    floater(bd.x, bd.y - 1.4, 'Хрясь!', '#ffe0c0');
    logEvent('animal', 'Герой одолел медведя: шкуры и мясо', bd.x, bd.y);
    toast('Герой победил медведя! Шкуры и мясо остались на земле');
    Object.assign(bd, { state: 'away', t: 500 + Math.random() * 300, moving: false });
    return;
  }
  if (bd.sc <= 0 && bd.state !== 'flee') {
    bd.sc = 0.4;
    const s = shooersNear(bd.x, bd.y, 4.5, 4, 0);                     // отогнать способны лишь четверо вместе
    if (s) { shooWave(s, 'Кыш!'); floater(bd.x, bd.y - 1.4, 'Р-р!', '#e0d0c0'); if (beOnce('bearShooStat', 25)) fstat('bearShoo'); bd.state = 'flee'; bd.path = null; animalGo(bd, bd.home[0], bd.home[1]); bd.t = 12; }
    else if (bd.state !== 'eat' || nearestPerson(bd, 1.4, u => isPerson(u))) {
      const p = nearestPerson(bd, 2.4, u => isPerson(u) && !u.dead);
      if (p && bd.cd <= 0) { bd.state = 'maul'; bd.tgt = p; bd.t = 6; }
    }
  }
  if (bd.state === 'flee') {
    if (animalStep(bd, dt, 2.4) || !bd.path || bd.t <= 0) { bd.state = 'roam'; bd.t = 3; bd.moving = false; }
  } else if (bd.state === 'maul') {
    const p = bd.tgt;
    if (!p || p.inside || p.dead || bd.t <= 0) { bd.state = 'roam'; bd.t = 3; bd.cd = 6; bd.moving = false; return; }
    const d = Math.hypot(p.x - bd.x, p.y - bd.y);
    if (d > 1.0) beStep(bd, p.x, p.y, 2.5, dt, (x, y) => inb(x, y) && World.terrain[idx(x, y)] !== T_ROCK && World.terrain[idx(x, y)] !== T_WATER);
    else {
      bd.moving = false; bd.mc = (bd.mc || 0) - dt;
      if (bd.mc <= 0) {
        bd.mc = 2.2;
        p.ouchUntil = Game.time + 2; floater(bd.x, bd.y - 1.4, 'Р-р!', '#e0d0c0'); floater(p.x, p.y - 1.4, 'Ай!', '#ffc8a0');
        if (!p.injury && Math.random() < 0.85) { injure(p, Math.random() < 0.5 ? 'arm' : 'leg'); p.injuryUntil = Game.time + 50; }
        fstat('bearMaul');
        logEvent('animal', `Медведь помял ${p.type === 'hero' ? 'героя' : 'гнома'}`, p.x, p.y);
        if (beOnce('bearToast', 120)) toast('Медведь напал! Отогнать его могут четверо вместе, героя он ломает');
        if (p.type !== 'hero') { bd.state = 'roam'; bd.t = 3; bd.cd = 12; }
      }
    }
  } else if (bd.state === 'honey') {
    const hv = bd.hive;
    if (!hv || !(Game.hives || []).includes(hv)) { bd.state = 'roam'; bd.t = 2; return; }
    if (animalStep(bd, dt, 1.7) || !bd.path) {
      bd.state = 'eat'; bd.eat = 0; bd.moving = false;
      floater(hv.x, hv.y - 1.4, 'Жжж…', '#f0e090');
    }
  } else if (bd.state === 'eat') {
    bd.eat += dt; bd.moving = false;
    if (bd.eat > 5) {
      const hv = bd.hive, n = hv ? Math.max(hv.honey, 1) : 0;
      if (hv && (Game.hives || []).includes(hv)) {
        hv.honey = 0; hv.raid = Game.time; fstat('bearHoney');
        floater(bd.x, bd.y - 1.4, 'Р-р!', '#e0d0c0');
        logEvent('animal', `Медведь разорил улей и съел мёд (${n})`, hv.x, hv.y);
        if (beOnce('bearHoneyToast', 120)) toast('Медведь разорил улей и съел мёд!');
      }
      bd.state = 'leave'; bd.path = null; animalGo(bd, bd.home[0], bd.home[1]); bd.hive = null;
    }
  } else if (bd.state === 'leave') {
    if (animalStep(bd, dt, 1.5) || !bd.path) { bd.state = 'roam'; bd.t = 8; bd.moving = false; }
  } else {                                                            // бродит у леса, тянется к ульям
    if (bd.life <= 0) { Object.assign(bd, { state: 'away', t: 240 + Math.random() * 200, moving: false }); return; }
    if (bd.path) { animalStep(bd, dt, 0.8); return; }
    if (bd.t <= 0) {
      bd.t = 4 + Math.random() * 5;
      const cand = (Game.hives || []).filter(h => h.honey >= 1 && Game.time - h.raid > 150).sort((a, b) => Math.hypot(a.x - bd.x, a.y - bd.y) - Math.hypot(b.x - bd.x, b.y - bd.y))[0];
      if (cand && Math.random() < 0.6) { bd.hive = cand; bd.state = 'honey'; animalGo(bd, Math.floor(cand.x), Math.floor(cand.y + 1)); return; }
      const t = randomFreeNear(bd.home[0], bd.home[1], 0, 6, (x, y) => isWalkable(x, y) && !World.road[idx(x, y)]);
      if (t) animalGo(bd, t[0], t[1]);
    }
  }
}
function beDrawBear(c, bd) {
  if (bd.state === 'away') return;
  const px = bd.x * TILE, py = bd.y * TILE + 5;
  if (bd.state === 'eat') beDraw(c, 'bearE', BEAR_EAT, px, py, bd.face, Math.round(Math.sin(bd.eat * 7)), true);
  else if (bd.moving) { const i = Math.floor(bd.ph * 0.9 * 4) % 8; beDraw(c, 'bearW' + i, gaitRows(BEAR_A, 3, 8, i), px, py, bd.face); }
  else beDraw(c, 'bearA', BEAR_A, px, py, bd.face);
  if (bd.state === 'eat') {                                           // разъярённые пчёлы вокруг морды
    for (let k = 0; k < 4; k++) {
      const a = Game.time * 9 + k * 1.6, x = Math.round(px + bd.face * 12 + Math.cos(a) * 8), y = Math.round(py - 14 + Math.sin(a * 1.3) * 5);
      c.fillStyle = '#2a2010'; c.fillRect(x, y, 3, 2); c.fillStyle = '#f0c030'; c.fillRect(x + 1, y, 1, 2);
    }
  }
}

// ---------- Коты ----------
function beCatHomes() { return Game.buildings.filter(b => b.state === 'done' && !b.removed && (b.type === 'storehouse' || b.type === 'bakery')); }
function beNewCat(v, x, y, home) {
  return { v, x, y, home, tame: 0, state: 'idle', t: 1 + Math.random() * 2, face: Math.random() < 0.5 ? 1 : -1, ph: 0, moving: false, go: null, fed: 20, purr: 5, hs: 0, prey: null };
}
// Угощение: хлеб, колбаса или стейк из запасов дома кота (чуть-чуть, не больше трёх раз на кота)
function beCatFood(b) {
  if (!b.stock || !b.reserved) return null;
  const keep = b.type === 'storehouse' ? 6 : 3;
  for (const g of ['bread', 'sausage', 'steak', 'croissant']) {
    if (b.stock[g] - b.reserved[g] >= keep) { b.stock[g]--; return g; }
  }
  return null;
}
function beCatsTick(dt) {
  const cats = Game.cats || (Game.cats = []);
  const homes = beCatHomes();
  Game.catT = (Game.catT ?? 25) - dt;
  if (Game.catT <= 0) {
    Game.catT = 70 + Math.random() * 80;
    if (homes.length && cats.length < 4) {
      const used = new Set(cats.map(k => k.v)), free = [0, 1, 2, 3].filter(v => !used.has(v));
      const h = homes[(Math.random() * homes.length) | 0];
      const s = randomFreeNear(h.doorX, h.doorY, 9, 13, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)]);
      if (s) {
        const v = free[(Math.random() * free.length) | 0];
        cats.push(beNewCat(v, s[0] + 0.5, s[1] + 0.5, h));
        fstat('cat');
        logEvent('animal', `К ${BUILDINGS[h.type].name.toLowerCase().replace(/^склад$/, 'складу')} прибился кот: ${CAT_VARS[v].n}`, s[0], s[1]);
        if (beOnce('catToast', 200)) toast(`К поселению прибился кот (${CAT_VARS[v].n}). Накормите — приручится`);
      }
    }
  }
  const sleepy = nightAmt() > 0.55 || isRaining();
  for (let i = cats.length - 1; i >= 0; i--) {
    const c = cats[i];
    c.t -= dt; c.hs -= dt; c.fed -= dt; c.purr -= dt;
    if (!c.home || c.home.removed || c.home.state !== 'done') c.home = homes[0] || null;
    const hx = c.home ? c.home.doorX + 0.5 : c.x, hy = c.home ? c.home.doorY + 1.2 : c.y;
    const p = nearestPerson(c, 1.9, u => isPerson(u) && u.type !== 'carter' && !u.dead);
    // охота на мышей
    if (c.state !== 'hunt' && c.hs <= 0 && !(sleepy && c.state === 'sleep')) {
      c.hs = 0.8;
      const mice = Game.mice || [];
      let best = null, bd2 = 49;
      for (const m of mice) { const d = (m.x - c.x) ** 2 + (m.y - c.y) ** 2; if (d < bd2) { bd2 = d; best = m; } }
      if (best && (!p || c.tame)) { c.state = 'hunt'; c.prey = best; c.t = 8; }
    }
    if (c.state === 'hunt') {
      const m = c.prey, mice = Game.mice || [];
      const mi = mice.indexOf(m);
      if (mi < 0 || c.t <= 0) { c.state = 'idle'; c.t = 2; c.prey = null; c.moving = false; }
      else {
        if (Math.hypot(m.x - c.x, m.y - c.y) < 3 && m.state !== 'flee') { m.state = 'flee'; floater(m.x, m.y - 0.5, 'Пи!', '#e8e0d0'); }
        const ok = beStep(c, m.x, m.y, 3.3, dt, beLand);
        if (Math.hypot(m.x - c.x, m.y - c.y) < 0.55 && Math.random() < 1) {
          mice.splice(mi, 1);
          if (m.carry) dropPile(Math.floor(m.x), Math.floor(m.y), 'flour', 1);
          fstat('catMouse'); floater(c.x, c.y - 0.9, 'Мяу!', '#ffe8d0');
          logEvent('animal', `Кот (${CAT_VARS[c.v].n}) поймал мышь`, c.x, c.y);
          if (beOnce('catMouseToast', 240)) toast('Кот поймал мышь — муке спокойнее');
          c.state = 'idle'; c.t = 4; c.prey = null; c.moving = false;
        } else if (!ok && !c.moving) { c.state = 'idle'; c.t = 1.5; c.prey = null; }
      }
      continue;
    }
    // угощение у склада или пекарни
    if (!c.tame && c.fed <= 0 && c.home && Math.hypot(c.x - hx, c.y - hy) < 6) {
      const g = beCatFood(c.home);
      c.fed = 25 + Math.random() * 20;
      if (g) {
        c.tame++; fstat('catFed');
        floater(c.x, c.y - 0.9, 'Мяу!', '#ffe8d0'); floater(c.x, c.y - 1.5, '♥', '#ff8aa8');
        if (c.tame >= 3) {
          fstat('catTame');
          logEvent('animal', `Кот приручился: ${CAT_VARS[c.v].n} поселился у ${BUILDINGS[c.home.type].name.toLowerCase()}`, c.x, c.y);
          toast(`Кот (${CAT_VARS[c.v].n}) приручён и остаётся у ${BUILDINGS[c.home.type].name.toLowerCase()}`);
        }
      }
    }
    // дикий кот держится от людей подальше
    if (p && !c.tame && c.state !== 'sleep') {
      const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy) || 1;
      beStep(c, c.x + dx / d * 2, c.y + dy / d * 2, 2.6, dt, beLand);
      c.state = 'shy'; c.t = 1.2; continue;
    }
    if (c.state === 'shy') { c.state = 'idle'; c.moving = false; }
    if (c.tame && p && c.purr <= 0 && c.state !== 'sleep') { c.purr = 8 + Math.random() * 8; floater(c.x, c.y - 0.9, 'Мур-р…', '#ffe8d0'); }
    if (c.tame && !p && Math.random() < dt * 0.01) floater(c.x, c.y - 0.9, 'Мяу!', '#ffe8d0');
    // сон, прогулки
    if (c.state === 'sleep') { c.moving = false; if (!sleepy) { c.state = 'idle'; c.t = 1; } continue; }
    if (sleepy && c.state !== 'gosleep') {
      const t = c.home ? randomFreeNear(c.home.doorX, c.home.doorY, 1, 3, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)]) : null;
      c.go = t ? [t[0] + 0.5, t[1] + 0.5] : [c.x, c.y]; c.state = 'gosleep';
    }
    if (c.state === 'gosleep') {
      if (beStep(c, c.go[0], c.go[1], 1.3, dt, beLand) || !c.moving) { c.state = sleepy ? 'sleep' : 'idle'; c.moving = false; }
      continue;
    }
    if (c.state === 'walk') {
      if (beStep(c, c.go[0], c.go[1], c.tame ? 1.0 : 0.9, dt, beLand)) { c.state = 'idle'; c.t = 3 + Math.random() * 7; c.moving = false; }
      else if (!c.moving) { c.state = 'idle'; c.t = 2; }
      continue;
    }
    c.moving = false;
    if (c.t <= 0) {
      if (Math.random() < 0.6 && c.home) {
        const t = randomFreeNear(Math.floor(hx), Math.floor(hy), 1, 4, (x, y) => isWalkable(x, y) && !World.bmap[idx(x, y)]);
        if (t) { c.go = [t[0] + 0.5, t[1] + 0.5]; c.state = 'walk'; }
      }
      c.t = 3 + Math.random() * 6;
    }
  }
}
function beDrawCat(c, k) {
  const px = k.x * TILE, py = k.y * TILE + 3, pal = CAT_VARS[k.v].pal;
  const key = 'cat' + k.v;
  if (k.state === 'sleep') beDraw(c, key + 's', CAT_SLEEP, px, py, k.face, 0, true, pal);
  else if (k.moving) { const i = Math.floor(k.ph * 0.9 * 3) % 6; beDraw(c, key + 'w' + i, gaitRows(CAT_WALK_A, 2, 6, i), px, py, k.face, 0, true, pal); }
  else beDraw(c, key + 'i', CAT_SIT, px, py, k.face, 0, true, pal);
}

// ---------- Рыба ----------
function beWaterInner(x, y) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!isWaterAt(x + dx, y + dy)) return false;
  return true;
}
function beNearLand(x, y, r) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inb(x + dx, y + dy) && !isWaterAt(x + dx, y + dy)) return true;
  return false;
}
function beFishTick(dt) {
  const F = Game.fish || (Game.fish = []);
  Game.fishT = (Game.fishT ?? 2) - dt;
  if (Game.fishT <= 0) {
    Game.fishT = 5;
    if (F.length < 9 && beDone() >= 1) {
      const cx = MAP_W >> 1, cy = MAP_H >> 1;
      for (let k = 0; k < 120; k++) {
        const x = (Math.random() * MAP_W) | 0, y = (Math.random() * MAP_H) | 0;
        if (Math.hypot(x - cx, y - cy) > 38 || !isWaterAt(x, y) || !beWaterInner(x, y) || !beNearLand(x, y, 3)) continue;
        F.push({ x: x + 0.5, y: y + 0.5, a: Math.random() * 6.28, face: 1, ph: Math.random() * 9, jump: 0, next: 3 + Math.random() * 8 });
        break;
      }
    }
  }
  const sp = Game.splash || (Game.splash = []);
  for (let i = sp.length - 1; i >= 0; i--) if (Game.time - sp[i].t0 > 0.9) sp.splice(i, 1);
  for (const f of F) {
    f.ph += dt;
    if (f.jump > 0) {
      f.jump += dt / 0.85;
      if (f.jump >= 1) { f.jump = 0; sp.push({ x: f.x, y: f.y, t0: Game.time }); if (sp.length > 24) sp.shift(); }
      continue;
    }
    f.next -= dt;
    const nx = f.x + Math.cos(f.a) * 0.3 * dt, ny = f.y + Math.sin(f.a) * 0.3 * dt;
    if (isWaterAt(Math.floor(nx), Math.floor(ny))) { f.x = nx; f.y = ny; } else f.a += 2 + Math.random() * 2;
    if (Math.random() < dt * 0.3) f.a += (Math.random() - 0.5) * 1.5;
    f.face = Math.cos(f.a) >= 0 ? 1 : -1;
    if (f.next <= 0) {
      f.next = 5 + Math.random() * 10;
      if (isWaterAt(Math.floor(f.x + f.face), Math.floor(f.y))) { f.jump = 0.001; sp.push({ x: f.x, y: f.y, t0: Game.time }); }
    }
  }
}
function beDrawFish(c, f) {
  const px = f.x * TILE, py = f.y * TILE;
  if (f.jump <= 0) {
    c.fillStyle = 'rgba(8,24,40,0.32)'; c.beginPath(); c.ellipse(px, py + 1, 6, 2.2, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(8,24,40,0.2)'; c.fillRect(Math.round(px) - 6 * f.face, Math.round(py), 3, 2);
    return;
  }
  const j = f.jump, h = Math.sin(j * Math.PI) * 13;
  const spr = beSpr('fish', BE_FISH);
  c.fillStyle = 'rgba(8,24,40,0.25)'; c.beginPath(); c.ellipse(px, py + 1, 5, 1.8, 0, 0, 7); c.fill();
  c.imageSmoothingEnabled = false;
  c.save(); c.translate(Math.round(px), Math.round(py - h - 3)); c.scale(f.face, 1); c.rotate((j - 0.5) * 1.5);
  c.drawImage(spr, -5, -2);
  c.restore();
  const g = Math.sin(j * Math.PI * 3);                                // блик на чешуе
  if (g > 0.3) { c.fillStyle = '#ffffff'; c.fillRect(Math.round(px) + 2, Math.round(py - h - 6), 1, 1); c.fillRect(Math.round(px) + 1, Math.round(py - h - 5), 3, 1); c.fillRect(Math.round(px) + 2, Math.round(py - h - 4), 1, 1); }
  c.imageSmoothingEnabled = R.smooth;
}
function beDrawSplash(c, s) {
  const k = (Game.time - s.t0) / 0.9;
  if (k < 0 || k > 1) return;
  c.strokeStyle = `rgba(220,240,255,${0.7 * (1 - k)})`; c.lineWidth = 1;
  c.beginPath(); c.ellipse(s.x * TILE, s.y * TILE, 2 + k * 9, 1 + k * 4, 0, 0, 7); c.stroke();
  if (k < 0.45) { c.fillStyle = 'rgba(255,255,255,0.8)'; for (let n = 0; n < 4; n++) c.fillRect(Math.round(s.x * TILE) + (n - 1.5) * 3, Math.round(s.y * TILE - k * 14 * (1 + (n % 2) * 0.4)), 1, 1); }
}
function beNearestFish(x, y, r) {
  let best = null, bd = r;
  for (const f of Game.fish || []) { if (f.jump > 0) continue; const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } }
  return best;
}

// ---------- Аист ----------
function beWaterNear(x, y, r) {
  for (let k = 0; k < 90; k++) {
    const xx = Math.round(x + (Math.random() * 2 - 1) * r), yy = Math.round(y + (Math.random() * 2 - 1) * r);
    if (isWaterAt(xx, yy)) return true;
  }
  return false;
}
function beStorkNestPos(b) {
  const top = (BUILDINGS[b.type].top || 60);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2, z: top * 0.22 + b.h * 16 };     // гребень крыши в косой проекции лежит почти на верхней кромке следа здания
}
function beStorkTick(dt) {
  let s = Game.stork;
  if (s && (s.b.removed || s.b.state !== 'done')) { Game.stork = s = null; }
  if (!s) {
    Game.stT = (Game.stT ?? 20) - dt;
    if (Game.stT > 0) return;
    Game.stT = 30;
    if (beDone() < 4) return;
    const cand = Game.buildings.filter(b => b.state === 'done' && !b.removed && (BUILDINGS[b.type].top || 0) >= 56 && beWaterNear(b.doorX, b.doorY, 16));
    if (!cand.length) return;
    const b = cand.sort((p, q) => BUILDINGS[q.type].top - BUILDINGS[p.type].top)[(Math.random() * Math.min(2, cand.length)) | 0];
    const n = beStorkNestPos(b);
    Game.stork = { b, x: n.x, y: n.y, z: n.z, nz: n.z, state: 'nest', t: 15 + Math.random() * 20, face: 1, ph: 0, fish: false, fedN: 0, chicks: 0, target: null };
    fstat('stork');
    logEvent('animal', `Аисты свили гнездо на крыше: ${BUILDINGS[b.type].name.toLowerCase()}`, b.x, b.y);
    if (beOnce('storkToast', 300)) toast('На высокой крыше поселились аисты — говорят, к прибавлению');
    return;
  }
  s.ph += dt; s.t -= dt;
  if (s.state === 'nest') {
    if (Math.random() < dt * 0.06) floater(s.x, s.y - s.z / TILE - 0.7, 'Клац-клац!', '#f4f0e0');
    if (s.t <= 0) {
      if (!beDay() || !(Game.fish || []).length) { s.t = 20; return; }
      const f = (Game.fish || []).slice().sort((p, q) => Math.hypot(p.x - s.x, p.y - s.y) - Math.hypot(q.x - s.x, q.y - s.y))[0];
      if (Math.hypot(f.x - s.x, f.y - s.y) > 34) { s.t = 40; return; }
      s.state = 'out'; s.target = f; s.d0 = Math.hypot(f.x - s.x, f.y - s.y); s.fish = false;
    }
  } else if (s.state === 'out') {
    const f = s.target;
    if (!f || !(Game.fish || []).includes(f)) { s.state = 'back'; return; }
    const dx = f.x - s.x, dy = f.y - s.y, d = Math.hypot(dx, dy);
    const sp = 4 * dt;
    if (d < 0.3) { s.state = 'wade'; s.t = 2.2; s.z = 0; return; }
    s.x += dx / d * Math.min(d, sp); s.y += dy / d * Math.min(d, sp); s.face = dx > 0 ? 1 : -1;
    s.z = Math.min(s.nz, d * 10 + 2);
  } else if (s.state === 'wade') {
    s.z = 0;
    if (s.t <= 0) {
      const f = s.target;
      if (f && (Game.fish || []).includes(f)) {
        Game.fish.splice(Game.fish.indexOf(f), 1); s.fish = true; fstat('storkFish');
        (Game.splash || (Game.splash = [])).push({ x: s.x, y: s.y, t0: Game.time });
        floater(s.x, s.y - 1.2, 'Клац!', '#f4f0e0');
        if (beOnce('storkLog', 240)) logEvent('animal', 'Аист поймал рыбу в озере', s.x, s.y);
      }
      s.state = 'back';
    }
  } else if (s.state === 'back') {
    const dx = s.b.x + s.b.w / 2 - s.x, dy = s.b.y + s.b.h / 2 - s.y, d = Math.hypot(dx, dy);
    if (d < 0.3) {
      s.x = s.b.x + s.b.w / 2; s.y = s.b.y + s.b.h / 2; s.z = s.nz; s.state = 'nest'; s.t = 35 + Math.random() * 40;
      if (s.fish) {
        s.fish = false; s.fedN++; fstat('storkFeed'); floater(s.x, s.y - s.z / TILE - 0.7, 'Клац-клац!', '#f4f0e0');
        if (s.fedN === 3 && !s.chicks) {
          s.chicks = 2; fstat('storkChicks');
          logEvent('animal', 'В гнезде на крыше пищат птенцы аиста', s.x, s.y);
          if (beOnce('chickToast', 600)) toast('У аистов вылупились птенцы — в деревне будет прибавление (пока лишь для красоты)');
        }
      }
      return;
    }
    s.x += dx / d * Math.min(d, 3.8 * dt); s.y += dy / d * Math.min(d, 3.8 * dt); s.face = dx > 0 ? 1 : -1;
    s.z = Math.min(s.nz, s.z + 30 * dt);
  }
}
function beDrawStorkNest(c, s) {
  const n = beStorkNestPos(s.b), px = n.x * TILE, py = n.y * TILE - n.z + 2;
  c.fillStyle = '#4a3418'; c.fillRect(Math.round(px) - 9, Math.round(py) - 3, 18, 4);
  c.fillStyle = '#6a4c26'; c.fillRect(Math.round(px) - 7, Math.round(py) - 5, 14, 3);
  c.fillStyle = '#8a6a38'; for (let k = 0; k < 5; k++) c.fillRect(Math.round(px) - 8 + k * 4, Math.round(py) - 5 - (k % 2), 3, 1);
  c.fillStyle = '#2e2010'; c.fillRect(Math.round(px) - 9, Math.round(py) + 1, 18, 1);
  if (s.chicks) {
    for (let k = 0; k < s.chicks; k++) {
      const bob = (Math.floor(Game.time * 3 + k) & 1);
      c.fillStyle = '#f0ece0'; c.fillRect(Math.round(px) - 6 + k * 4, Math.round(py) - 8 - bob, 3, 3);
      c.fillStyle = '#e07050'; c.fillRect(Math.round(px) - 4 + k * 4, Math.round(py) - 7 - bob, 2, 1);
    }
  }
}
function beDrawStork(c, s) {
  const px = s.x * TILE;
  if (s.state === 'nest') { const n = beStorkNestPos(s.b); beDraw(c, 'storkN', STORK_S.slice(0, 13), n.x * TILE - 2, n.y * TILE - n.z + 4, s.face, 0, false); return; }
  const air = s.state === 'out' || s.state === 'back';
  const py = s.y * TILE + 4;
  c.fillStyle = 'rgba(10,8,4,' + (air ? 0.16 : 0.28) + ')'; c.beginPath(); c.ellipse(px, py, 6, 2, 0, 0, 7); c.fill();
  if (air && s.z > 1.5) {
    const spr = beFlySprite('storkF', BE_STORK_FLY, Math.floor(s.ph * 10) & 7);
    c.imageSmoothingEnabled = false;
    c.save(); c.translate(Math.round(px), Math.round(py - s.z - 10)); if (s.face < 0) c.scale(-1, 1); c.drawImage(spr, -15, 0); c.restore();
    c.imageSmoothingEnabled = R.smooth;
    if (s.fish) { c.fillStyle = '#c8dce8'; c.fillRect(Math.round(px) + s.face * 12 - 2, Math.round(py - s.z - 4), 5, 2); }
  } else beDraw(c, 'storkS', STORK_S, px, py, s.face, 0, false);
}

// ---------- Цапля ----------
function beHeronsTick(dt) {
  const hs = Game.herons || (Game.herons = []);
  Game.hrT = (Game.hrT ?? 30) - dt;
  if (Game.hrT <= 0) {
    Game.hrT = 40 + Math.random() * 50;
    if (!hs.length && beDay() && beDone() >= 2 && (Game.fish || []).length) {
      const f = Game.fish[(Math.random() * Game.fish.length) | 0];
      let spot = null;
      for (let k = 0; k < 40 && !spot; k++) {
        const x = Math.round(f.x + (Math.random() * 2 - 1) * 4), y = Math.round(f.y + (Math.random() * 2 - 1) * 4);
        if (isWaterAt(x, y) && beNearLand(x, y, 1) && !World.bmap[idx(x, y)]) spot = [x + 0.5, y + 0.5];
      }
      if (spot) {
        hs.push({ x: spot[0] + (Math.random() < 0.5 ? 14 : -14), y: spot[1] - 8, z: 30, state: 'fly', spot, t: 3, face: 1, ph: Math.random() * 9, moving: false, hold: false, sc: 0, prey: null, life: 200 + Math.random() * 150 });
        fstat('heron');
        if (beOnce('heronLog', 500)) logEvent('animal', 'На мелководье вышла цапля — высматривает рыбу', spot[0], spot[1]);
      }
    }
  }
  for (let i = hs.length - 1; i >= 0; i--) {
    const h = hs[i];
    h.ph += dt; h.t -= dt; h.life -= dt; h.sc -= dt;
    if (h.state !== 'leave' && h.state !== 'fly' && h.sc <= 0) {
      h.sc = 0.35;
      const s = shooersNear(h.x, h.y, 4, 3, 3);                       // как с гусями: герой или трое гномов
      if (s) {
        shooWave(s, 'Кыш!'); floater(h.x, h.y - 1.8, 'Кр-р!', '#d8e0e8'); fstat('heronShoo');
        if (beOnce('heronShooLog', 60)) logEvent('animal', s.hero ? 'Герой прогнал цаплю с мелководья' : 'Гномы прогнали цаплю с мелководья', h.x, h.y);
        h.state = 'leave'; h.z = 2; h.ex = h.x + (h.x > MAP_W / 2 ? 40 : -40); h.ey = h.y - 18; continue;
      }
    }
    if (h.state === 'fly') {
      const dx = h.spot[0] - h.x, dy = h.spot[1] - h.y, d = Math.hypot(dx, dy);
      if (d < 0.3) { h.x = h.spot[0]; h.y = h.spot[1]; h.z = 0; h.state = 'stand'; h.t = 2 + Math.random() * 2; continue; }
      const s = Math.min(d, 4 * dt); h.x += dx / d * s; h.y += dy / d * s; h.face = dx > 0 ? 1 : -1; h.z = Math.min(h.z, d * 9 + 2);
    } else if (h.state === 'leave') {
      const dx = h.ex - h.x, dy = h.ey - h.y, d = Math.hypot(dx, dy);
      h.z = Math.min(40, h.z + 24 * dt); h.face = dx > 0 ? 1 : -1;
      h.x += dx / d * 5 * dt; h.y += dy / d * 5 * dt;
      if (d < 2 || h.x < -4 || h.x > MAP_W + 4) { hs.splice(i, 1); Game.hrT = Math.max(Game.hrT, 70 + Math.random() * 60); }
    } else if (h.state === 'stand') {
      h.moving = false;
      if (h.life <= 0) { h.state = 'leave'; h.z = 2; h.ex = h.x + 40; h.ey = h.y - 18; continue; }
      // удильщик с поклёвкой рядом — главная добыча
      if (!h.prey) {
        for (const u of Game.units) {
          if (u.inside || u.dead || !u.fun || u.fun.k !== 'rod') continue;
          if (Math.hypot(u.fun.wx - h.x, u.fun.wy - h.y) < 13) { h.prey = u; break; }
        }
      }
      if (h.prey) {
        const u = h.prey;
        if (!u.fun || u.fun.k !== 'rod' || u.dead) { h.prey = null; }
        else {
          const wx = u.fun.wx, wy = u.fun.wy;
          if (Math.hypot(wx - h.x, wy - h.y) > 1.3) {
            if (!beStep(h, wx, wy + 0.6, 1.7, dt, beShore) && !h.moving) { h.x = wx; h.y = wy + 0.6; }   // далеко или мель кончилась — перелетает
          } else {
            h.moving = false;
            if (u.fun.bite > Game.time) {                              // поклёвка: цапля хватает улов
              u.fun.stolen = true; u.fun.bite = 0; h.hold = true; h.state = 'gulp'; h.t = 1.6; h.prey = null;
              floater(h.x, h.y - 1.8, 'Хап!', '#e8f0f8'); floater(u.x, u.y - 1.4, 'Моя рыба!', '#ffd0a0');
              fstat('heronSteal');
              logEvent('animal', 'Цапля стащила улов у рыбака — прогоняйте её героем или втроём', h.x, h.y);
              if (beOnce('heronToast', 120)) toast('Цапля стащила улов у рыбака! Герой или трое гномов её прогонят');
              (Game.splash || (Game.splash = [])).push({ x: h.x, y: h.y, t0: Game.time });
            }
          }
          continue;
        }
      }
      if (h.t <= 0) {
        const f = beNearestFish(h.x, h.y, 2.3);
        if (f) { h.state = 'strike'; h.t = 0.45; h.tf = f; }
        else {                                                         // переступает по мелководью
          h.t = 2 + Math.random() * 3;
          const nx = Math.round(h.x + (Math.random() * 2 - 1) * 3), ny = Math.round(h.y + (Math.random() * 2 - 1) * 3);
          if (isWaterAt(nx, ny) && beNearLand(nx, ny, 1)) h.go = [nx + 0.5, ny + 0.5]; else h.go = null;
        }
      }
      if (h.go) { if (beStep(h, h.go[0], h.go[1], 0.5, dt, beShore) || !h.moving) h.go = null; }
    } else if (h.state === 'strike') {
      h.moving = false;
      if (h.t <= 0) {
        const f = h.tf;
        if (f && (Game.fish || []).includes(f) && Math.hypot(f.x - h.x, f.y - h.y) < 2.6 && Math.random() < 0.7) {
          Game.fish.splice(Game.fish.indexOf(f), 1); h.hold = true; fstat('heronFish');
          (Game.splash || (Game.splash = [])).push({ x: f.x, y: f.y, t0: Game.time });
          if (beOnce('heronFishLog', 200)) logEvent('animal', 'Цапля выхватила рыбу из воды', h.x, h.y);
        }
        h.state = 'gulp'; h.t = 1.4;
      }
    } else if (h.state === 'gulp') {
      h.moving = false;
      if (h.t <= 0) { h.hold = false; h.state = 'stand'; h.t = 3 + Math.random() * 4; }
    }
  }
}
function beDrawHeron(c, h) {
  const px = h.x * TILE, py = h.y * TILE + 4;
  if (h.state === 'fly' || h.state === 'leave') {
    c.fillStyle = 'rgba(10,8,4,0.16)'; c.beginPath(); c.ellipse(px, py, 6, 2, 0, 0, 7); c.fill();
    const spr = beFlySprite('heronF', BE_HERON_FLY, Math.floor(h.ph * 10) & 7);
    c.imageSmoothingEnabled = false;
    c.save(); c.translate(Math.round(px), Math.round(py - h.z - 10)); if (h.face < 0) c.scale(-1, 1); c.drawImage(spr, -15, 0); c.restore();
    c.imageSmoothingEnabled = R.smooth;
    return;
  }
  // камыш вокруг
  const seed = Math.floor(h.spot ? h.spot[0] * 13 + h.spot[1] * 7 : 3);
  for (let k = 0; k < 5; k++) {
    const rx = Math.round(px + ((k * 9 + seed) % 22) - 11), ry = Math.round(py - 1 + (k % 2) * 2), sw = Math.round(Math.sin(Game.time * 1.4 + k) * 1);
    c.fillStyle = '#7a8a3a'; c.fillRect(rx + sw, ry - 12 - (k % 3) * 2, 1, 12);
    c.fillStyle = '#5a3a1c'; c.fillRect(rx + sw, ry - 14 - (k % 3) * 2, 2, 4);
  }
  const strike = h.state === 'strike';
  beDraw(c, strike ? 'heronK' : 'heronS', strike ? HERON_STRIKE : HERON_S, px, py, h.face, 0, true);
  if (h.hold) { c.fillStyle = '#cfe0ea'; c.fillRect(Math.round(px) + h.face * 7 - 2, Math.round(py) - 22, 5, 2); }
}

// ---------- Стая ворон над полем ----------
function beScarecrowNear(fx, fy) {
  for (let y = fy - 7; y <= fy + 7; y++) for (let x = fx - 7; x <= fx + 7; x++) {
    if (!inb(x, y)) continue;
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'magic' && o.v === 2) return true;
  }
  return false;
}
function beFlockTick(dt) {
  let fl = Game.flock;
  if (!fl) fl = Game.flock = { state: 'away', t: 150 + Math.random() * 120, crows: [] };
  if (fl.state === 'away') {
    fl.t -= dt;
    if (fl.t > 0) return;
    if (!beDay() || beDone() < 3) { fl.t = 25; return; }
    let fx = -1, fy = -1;
    for (let k = 0; k < 250; k++) {
      const i = (Math.random() * N_TILES) | 0, o = World.obj[i];
      if (o && o.t === 'field' && !o.plan && o.farm && o.g >= 0.3) { fx = i % MAP_W; fy = (i / MAP_W) | 0; break; }
    }
    if (fx < 0) { fl.t = 60; return; }
    const ang = Math.random() * 6.28, n = 9 + ((Math.random() * 6) | 0);
    fl.crows = [];
    for (let k = 0; k < n; k++) fl.crows.push({ a: Math.random() * 6.28, r: 1 + Math.random() * 2.2, ph: Math.random() * 9, ox: 0, oy: 0, z: 36 + Math.random() * 20, w: 0.7 + Math.random() * 0.5 });
    Object.assign(fl, { state: 'in', fx, fy, x: fx + Math.cos(ang) * 34, y: fy + Math.sin(ang) * 26, t: 0, peckT: 0, scared: beScarecrowNear(fx, fy), face: 1 });
    return;
  }
  fl.t += dt;
  for (const c of fl.crows) { c.a += c.w * dt; c.ph += dt; }
  const air = fl.state === 'in' || fl.state === 'circle' || fl.state === 'leave';
  if (fl.state === 'in') {
    const dx = fl.fx + 0.5 - fl.x, dy = fl.fy + 0.5 - fl.y, d = Math.hypot(dx, dy);
    if (d < 1) { fl.state = 'circle'; fl.t = 0; floater(fl.fx + 0.5, fl.fy - 1, 'Кар!', '#d8d8f0'); }
    else { fl.x += dx / d * 5 * dt; fl.y += dy / d * 5 * dt; fl.face = dx > 0 ? 1 : -1; }
  } else if (fl.state === 'circle') {
    if (fl.t > 7) {
      if (fl.scared) {                                                // пугало за краем поля: стая покружила и улетела
        fl.state = 'leave'; fstat('scarecrowSaved');
        if (beOnce('scareLog', 300)) logEvent('animal', 'Пугало отпугнуло стаю ворон от поля', fl.fx, fl.fy);
      } else {
        fl.state = 'land'; fl.t = 0;
        for (const c of fl.crows) { c.ox = (Math.random() - 0.5) * 5; c.oy = (Math.random() - 0.5) * 3.4; }
        fstat('flock');
        logEvent('animal', 'Большая стая ворон села на поле и клюёт урожай', fl.fx, fl.fy);
        if (beOnce('flockToast', 150)) toast('Стая ворон клюёт урожай на поле! Прогоните их героем, втроём или поставьте пугало');
      }
    }
  } else if (fl.state === 'land') {
    fl.peckT += dt;
    if (fl.peckT > 2.4) {
      fl.peckT = 0;
      for (let k = 0; k < 6; k++) {
        const x = Math.round(fl.fx + (Math.random() - 0.5) * 5), y = Math.round(fl.fy + (Math.random() - 0.5) * 3.4);
        const o = inb(x, y) ? World.obj[idx(x, y)] : null;
        if (o && o.t === 'field' && !o.plan && o.g > 0.25) { o.g = Math.max(0.2, o.g - 0.12); fstat('flockPeck'); break; }
      }
    }
    if (fl.t > 16) { fl.state = 'leave'; }
  }
  if (fl.state === 'leave') {
    fl.x += (fl.x > MAP_W / 2 ? 1 : -1) * 5 * dt; fl.y -= 3 * dt; fl.face = fl.x > MAP_W / 2 ? 1 : -1;
    if (fl.x < -6 || fl.x > MAP_W + 6 || fl.y < -6) { fl.state = 'away'; fl.t = 160 + Math.random() * 140; fl.crows = []; }
    return;
  }
  if (fl.state === 'circle' || fl.state === 'land') {
    fl.sc = (fl.sc || 0) - dt;
    if (fl.sc <= 0) {
      fl.sc = 0.35;
      const s = shooersNear(fl.fx + 0.5, fl.fy + 0.5, 5, 3, 4);
      if (s) {
        shooWave(s, 'Кыш!'); floater(fl.fx + 0.5, fl.fy - 1, 'Кар!', '#d8d8f0');
        fstat('flockShoo');
        logEvent('animal', s.hero ? 'Герой согнал стаю ворон с поля' : 'Гномы всем миром согнали ворон с поля', fl.fx, fl.fy);
        fl.state = 'leave';
      }
    }
  }
  void air;
}
function beDrawFlock(c, fl) {
  const landed = fl.state === 'land';
  for (const k of fl.crows) {
    let x, y, z;
    if (landed) { x = (fl.fx + 0.5 + k.ox) * TILE; y = (fl.fy + 0.5 + k.oy) * TILE; z = 0; }
    else if (fl.state === 'in' || fl.state === 'leave') { x = (fl.x + Math.cos(k.a * 0.4) * k.r * 1.5) * TILE; y = (fl.y + Math.sin(k.a * 0.4) * k.r) * TILE; z = k.z; }
    else { x = (fl.fx + 0.5 + Math.cos(k.a) * (2 + k.r)) * TILE; y = (fl.fy + 0.5 + Math.sin(k.a) * (1.4 + k.r * 0.5)) * TILE; z = k.z; }
    const py = y + 3;
    if (landed) {
      c.fillStyle = 'rgba(10,8,4,0.3)'; c.beginPath(); c.ellipse(x, py, 6, 2, 0, 0, 7); c.fill();
      const spr = crowSprite('s0'), peck = (Math.floor(k.ph * 3) & 1) ? 1 : 0;
      c.imageSmoothingEnabled = false;
      c.save(); c.translate(Math.round(x), Math.round(py - spr.height + 1 + peck)); if (k.ox < 0) c.scale(-1, 1); c.drawImage(spr, -Math.round(spr.width / 2), 0); c.restore();
    } else {
      c.fillStyle = 'rgba(10,8,4,0.12)'; c.beginPath(); c.ellipse(x, py, 5, 1.6, 0, 0, 7); c.fill();
      const spr = crowSprite('f' + [0, 1, 2, 1][Math.floor(k.ph * 9) & 3]);
      const dir = fl.state === 'circle' ? (Math.cos(k.a) * -Math.sin(k.a) >= 0 ? 1 : -1) * (k.w > 0 ? 1 : -1) : fl.face;
      c.imageSmoothingEnabled = false;
      c.save(); c.translate(Math.round(x), Math.round(py - z - spr.height * 0.62)); if (fl.state === 'circle' ? Math.sin(k.a) > 0 : dir < 0) c.scale(-1, 1); c.drawImage(spr, -Math.round(spr.width / 2), 0); c.restore();
    }
  }
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Сохранение ----------
function beastsReset() {
  Game.boars = []; Game.bear = null; Game.cats = []; Game.hives = []; Game.stork = null; Game.herons = []; Game.fish = []; Game.splash = []; Game.flock = null;
  Game.boarT = undefined; Game.catT = undefined; Game.stT = undefined; Game.hrT = undefined; Game.fishT = undefined;
  beLast = {};
}
function serializeBeasts() {
  const hv = (Game.hives || []).map(h => [+h.x.toFixed(2), +h.y.toFixed(2), h.honey]);
  const ct = (Game.cats || []).map(k => [k.v, k.tame, +k.x.toFixed(2), +k.y.toFixed(2)]);
  const s = Game.stork;
  const out = {};
  if (hv.length) out.hv = hv;
  if (ct.length) out.ct = ct;
  if (s) out.sk = [s.b.id, s.fedN, s.chicks];
  return Object.keys(out).length ? out : undefined;
}
function applyBeasts(d) {
  if (!d) return;
  for (const [x, y, honey] of d.hv || []) Game.hives.push(beNewHive(x, y, honey));
  const homes = beCatHomes();
  for (const [v, tame, x, y] of d.ct || []) {
    if (!CAT_VARS[v] || !inb(Math.floor(x), Math.floor(y))) continue;
    const c = beNewCat(v, x, y, homes[0] || null); c.tame = tame || 0;
    Game.cats.push(c);
  }
  if (d.sk) {
    const b = Game.buildings.find(q => q.id === d.sk[0] && q.state === 'done');
    if (b) { const n = beStorkNestPos(b); Game.stork = { b, x: n.x, y: n.y, z: n.z, nz: n.z, state: 'nest', t: 20, face: 1, ph: 0, fish: false, fedN: d.sk[1] || 0, chicks: d.sk[2] || 0, target: null }; }
  }
}

// ---------- Общий ход и отрисовка ----------
function beastsTick(dt) {
  if (!FAUNA_ON()) return;
  beFishTick(dt); beHivesTick(dt); beBoarsTick(dt); beBearTick(dt); beCatsTick(dt); beStorkTick(dt); beHeronsTick(dt); beFlockTick(dt); stTick(dt);
}

function beastsDrawList(list, c, x0, y0, x1, y1) {
  if (!FAUNA_ON()) return;
  const vis = (x, y) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 3 && y <= y1 + 3;
  for (const f of Game.fish || []) if (vis(f.x, f.y)) list.push([f.y - 0.3, () => beDrawFish(c, f)]);
  for (const s of Game.splash || []) if (vis(s.x, s.y)) list.push([s.y - 0.2, () => beDrawSplash(c, s)]);
  for (const h of Game.hives || []) if (vis(h.x, h.y)) { list.push([h.y + 0.15, () => beDrawHive(c, h)]); list.push([h.y + 1.4, () => beDrawBees(c, h)]); }
  for (const b of Game.boars || []) if (vis(b.x, b.y)) list.push([b.y + 0.1, () => beDrawBoar(c, b)]);
  const bd = Game.bear;
  if (bd && bd.state !== 'away' && vis(bd.x, bd.y)) list.push([bd.y + 0.12, () => beDrawBear(c, bd)]);
  for (const k of Game.cats || []) if (vis(k.x, k.y)) list.push([k.y + 0.08, () => beDrawCat(c, k)]);
  const s = Game.stork;
  if (s) {
    const n = beStorkNestPos(s.b);
    if (vis(n.x, n.y)) list.push([s.b.y + s.b.h + 0.6, () => beDrawStorkNest(c, s)]);
    if (s.state === 'nest') { if (vis(n.x, n.y)) list.push([s.b.y + s.b.h + 0.65, () => beDrawStork(c, s)]); }
    else if (vis(s.x, s.y)) list.push([s.y + (s.state === 'wade' ? 0.1 : 1.6), () => beDrawStork(c, s)]);
  }
  for (const h of Game.herons || []) if (vis(h.x, h.y)) list.push([h.y + (h.state === 'fly' || h.state === 'leave' ? 1.6 : 0.1), () => beDrawHeron(c, h)]);
  const fl = Game.flock;
  if (fl && fl.state !== 'away' && fl.crows.length && vis(fl.state === 'land' || fl.state === 'circle' ? fl.fx : fl.x, fl.state === 'land' || fl.state === 'circle' ? fl.fy : fl.y)) list.push([(fl.state === 'land' ? fl.fy + 0.5 : fl.fy + 2.5), () => beDrawFlock(c, fl)]);
  stDrawList(list, c, x0, y0, x1, y1);
}
