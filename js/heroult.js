'use strict';
// Ульты классов: шестая кнопка панели способностей (a.ult в HERO_ABIL, herokit.js), клавиша 6, с 13 уровня героя.
// Каждая ульта — своё действие (ABIL_FX.ult_*), своя анимация (вспышка, свечение, зона на земле), свой звук и значок 12×12
// (на панели и в карточке рисуется 16×16 с контуром: abilIcon16). Перезарядка 200–300 с, цена — почти весь ресурс класса.
// В общей деревне всё считает сервер (heroAbilityFor из herokit.js), клиент только рисует: зоны приходят с зеркалом мира (m.abz).
// Подключается сразу после heroabil.js.

const ULT = { hooked: false };

Object.assign(ABIL_COL, {
  ult_warrior: '#8ac8ff', ult_barbarian: '#ff4a2a', ult_archer: '#e8d0a0', ult_rogue: '#9a7ac8', ult_mage: '#ff8a30',
  ult_druid: '#7ae060', ult_priest: '#fff2a0', ult_paladin: '#ffd860', ult_bard: '#f090d0', ult_monk: '#ffc070',
});
Object.assign(ABIL_SND, {
  ult_warrior: 'ultHorn', ult_barbarian: 'ultRoar', ult_archer: 'ultRain', ult_rogue: 'ultShade', ult_mage: 'ultBoom',
  ult_druid: 'ultGrove', ult_priest: 'ultMiracle', ult_paladin: 'ultSun', ult_bard: 'ultSong', ult_monk: 'ultFlurry',
});

// ---------- Звуки (свой синтез на кирпичиках sfx.js; в тестах и на сервере звука нет) ----------
if (typeof SFX !== 'undefined' && typeof SFX_DEF !== 'undefined' && typeof tone === 'function') {
  const big = (len, wet) => ({ pri: 3, gain: 0.6, poly: 1, cd: 0.6, len, wet: wet || 0.3 });
  Object.assign(SFX_DEF, {
    ultHorn: big(1.6), ultRoar: big(1.6), ultRain: big(1.5), ultShade: big(1.2, 0.2), ultBoom: { pri: 2, gain: 0.6, poly: 2, cd: 0.18, len: 1.0, wet: 0.35 },
    ultGrove: big(1.6), ultMiracle: big(2.2, 0.5), ultSun: big(1.8, 0.45), ultSong: big(2.0, 0.35), ultFlurry: big(1.2, 0.1),
  });
  Object.assign(SFX, {
    // рог: два низких голоса и хриплое дыхание
    ultHorn: (d, t) => { tone(d, 'sawtooth', 98, 110, t, 1.3, 0.3, 0.12); tone(d, 'sawtooth', 147, 165, t + 0.05, 1.2, 0.2, 0.14); noiseHit(d, 'lowpass', 600, 300, 1, t, 1.0, 0.1, 0.2); },
    // рёв: тяжёлая пила вниз и рваный шум
    ultRoar: (d, t) => { tone(d, 'sawtooth', 130, 55, t, 1.2, 0.35, 0.03); tone(d, 'square', 65, 40, t, 1.2, 0.2, 0.03); noiseHit(d, 'bandpass', 500, 200, 1.5, t, 1.2, 0.3, 0.05); },
    // дождь стрел: нарастающий свист и россыпь воткнувшихся
    ultRain: (d, t) => {
      noiseHit(d, 'bandpass', 800, 3200, 1.2, t, 0.7, 0.3, 0.3);
      for (let k = 0; k < 9; k++) { const tt = t + 0.45 + k * 0.07 + Math.random() * 0.04; tone(d, 'sine', 240 + Math.random() * 80, 90, tt, 0.07, 0.25, 0.002); noiseHit(d, 'bandpass', 1800, 900, 2, tt, 0.05, 0.2, 0.001); }
    },
    // тени: быстрые взмахи
    ultShade: (d, t) => { for (let k = 0; k < 6; k++) noiseHit(d, 'bandpass', 700 + k * 350, 2500, 1.4, t + k * 0.09, 0.14, 0.3, 0.01); tone(d, 'triangle', 220, 110, t, 0.7, 0.12, 0.05); },
    // метеорит: глухой удар и затухающий гул
    ultBoom: (d, t) => { tone(d, 'sine', 140, 38, t, 0.9, 0.5, 0.004); noiseHit(d, 'lowpass', 900, 120, 0.8, t, 0.8, 0.45, 0.003); },
    // роща: скрип ветвей и шорох листвы
    ultGrove: (d, t) => { tone(d, 'triangle', 180, 340, t, 1.0, 0.15, 0.2); tone(d, 'triangle', 240, 160, t + 0.3, 1.0, 0.12, 0.2); noiseHit(d, 'bandpass', 2400, 1200, 1, t, 1.3, 0.14, 0.4); },
    // чудо: хор из трёх голосов и колокольчик
    ultMiracle: (d, t) => { for (const f of [392, 494, 587, 784]) tone(d, 'sine', f, f * 1.003, t, 1.9, 0.14, 0.5); for (const [f, k] of [[1568, 0.6], [2093, 0.8]]) tone(d, 'sine', f, f, t + k, 1.0, 0.1, 0.01); },
    // солнце: нарастающий звон
    ultSun: (d, t) => { tone(d, 'triangle', 330, 990, t, 0.9, 0.25, 0.3); for (const [f, k] of [[1320, 0.7], [1760, 0.85], [2640, 1.0]]) tone(d, 'sine', f, f, t + k, 0.8, 0.12, 0.005); },
    // баллада: быстрый перебор струн вверх
    ultSong: (d, t) => { [262, 330, 392, 523, 659, 784].forEach((f, k) => { tone(d, 'triangle', f, f * 0.99, t + k * 0.11, 0.55, 0.2, 0.004); tone(d, 'sine', f * 2, f * 2, t + k * 0.11, 0.3, 0.06, 0.004); }); },
    // тысяча ударов: частая дробь хлопков
    ultFlurry: (d, t) => { for (let k = 0; k < 14; k++) { const tt = t + k * 0.055; noiseHit(d, 'bandpass', 1200 + (k % 3) * 500, 700, 1.8, tt, 0.04, 0.35, 0.001); tone(d, 'sine', 180, 110, tt, 0.04, 0.15, 0.002); } },
  });
}

// ---------- Значки 12×12 ----------
Object.assign(ABIL_ICON, {
  ult_warrior: ['B:#2c4a9a L:#7aa0ff W:#e8f0ff Y:#f6d458', 'YYYYYYYYYYYY', 'YBBBBBBBBBBY', 'YBLLLWWLLLBY', 'YBLLLWWLLLBY', 'YBWWWWWWWWBY', 'YBWWWWWWWWBY', 'YBLLLWWLLLBY', '.YBLLWWLLBY.', '.YBBLWWLBBY.', '..YBBLLBBY..', '...YYBBYY...', '.....YY.....'],
  ult_barbarian: ['W:#f0e8d0 R:#c8302a O:#ff8a30 k:#2a1a10 S:#8a909c', 'W..........W', 'WW........WW', '.WW.SSSS.WW.', '.WSSSSSSSSW.', '..SSSSSSSS..', '..SkkSSkkS..', '..SRRSSRRS..', '..SSSSSSSS..', '...SSkkSS...', '....SSSS....', '...ROOOOR...', '....ROOR....'],
  ult_archer: ['a:#a06840 H:#dcdcd4 r:#e04a3a Y:#f6d458', '.r....r...r.', '.a....a...a.', '..a....a...a', '..a....a....', '...a....a...', '.Y.a.Y..a..Y', '....H.....H.', '...HHH...HHH', '.H..........', 'HHH...H...H.', '.....HHH.HHH', '............'],
  ult_rogue: ['S:#c8ccd0 W:#f4f4f4 P:#6a4a98 k:#2a2038 b:#5a3a1a', '.........SW.', '........SWS.', '.k.....SWS..', '.kk...SWS...', '..kk.SWS....', '...kkWS.....', '....bPb.....', '...bP.kk....', '..bP...kk...', '.PWS....kk..', 'SWS......k..', 'S..........k'],
  ult_mage: ['F:#c8302a O:#ff8a30 Y:#ffe070 W:#fff6d0', '..........F.', '........FF..', '.......FOF..', '..F...FOOF..', '...FFFOOYF..', '....FOOYYOF.', '...FOOYWWYF.', '..FOOYWWWYF.', '.FOOYYWWYOF.', '.F.FOYYYOF..', '....FOOOF...', '......FF....'],
  ult_druid: ['G:#3a8a30 g:#8ae070 b:#6a4a28 d:#4a3018', '...GGGGGG...', '..GggGGggG..', '.GgGGGGGGgG.', '.GGgGGGGgGG.', '..GGGGGGGG..', '...GGggGG...', '.....bb.....', '.....bb.....', '....dbbd....', '..g.dbbd.g..', '.gG.bbbb.Gg.', '..GG.bb.GG..'],
  ult_priest: ['Y:#ffe070 W:#fffbe0 L:#fff2a0', 'Y....WW....Y', '.Y...WW...Y.', '..Y.LWWL.Y..', '....LWWL....', 'Y..LLWWLL..Y', '..LLWWWWLL..', 'Y..LLWWLL..Y', '....LWWL....', '..Y.LWWL.Y..', '.Y...WW...Y.', 'Y....WW....Y', '..YYYYYYYY..'],
  ult_paladin: ['Y:#ffd860 O:#e0a030 W:#fffbe0 S:#c8ccd0', '..Y..YY..Y..', '...Y.YY.Y...', 'Y...OOOO...Y', '.Y.OYYYYO.Y.', '..OYYWWYYO..', 'YYOYWWWWYOYY', 'YYOYWWWWYOYY', '..OYYWWYYO..', '.Y.OYYYYO.Y.', 'Y...OOOO...Y', '...Y.SS.Y...', '..Y..SS..Y..'],
  ult_bard: ['P:#f090d0 Y:#ffd070 W:#fff0f8 k:#3a2416', '.....kkkkk..', '.....kPPPk..', '.....k......', '.....k......', '.....k......', '.Y...k......', 'YWY.kkk...Y.', '.Y.kkkkk.YWY', '...kkPkk..Y.', '...kkkkk....', 'Y...kkk..Y..', '..Y.....YWY.'],
  ult_monk: ['F:#e4b08a f:#b8845a Y:#ffd080 W:#fff0d0', 'Y..FFF..FFF.', '..FFFFFFFFFF', '.YFWFFFFWFFF', '..FFFFFFFFFF', 'Y..fFFFFFFf.', '.FFF..fFFf.Y', 'FFFFFY.ff...', 'FWFFFF.Y.FFF', 'FFFFFF..FFFF', '.fFFf..FWFFF', 'Y....Y.FFFFf', '..Y......ff.'],
});

// ---------- Общее ----------
const ultRnd = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const ULT_ZONES = { meteor: 1, grove: 1, sun: 1 };
const ultOwner = z => Game.unitMap && Game.unitMap.get(z.own);
// удар по врагу «насмерть для нечисти»: скелеты рассыпаются, деревья горят, камни пятятся, лесным жителям — урон
function ultBlast(f, own, mul, burn) {
  if (!abAlive(f)) return;
  const o = f.o;
  if (f.kind === 'skel') abForceKill(f, own);
  else if (f.kind === 'ent' && (o.rock || o.water)) { o.target = null; o.goal = null; o.state = 'ghosted'; o.t = 0; o.gFrom = [own.x, own.y]; floater(o.x, o.y - 1.8, 'Отступает!', '#ffd0a0'); }
  else if (f.kind === 'ent') { if (burn) { o.burnT = Game.time; floater(o.x, o.y - 3, 'Горит!', '#ffb060'); } else abForceKill(f, own); }
  else abHit(f, own, mul);
}
const ultTeamBuf = (h, r, buf, dur, mark) => { for (const m of abTeam(h, r)) { m.abShare = Object.assign({ t: Game.time + dur }, buf); m.abbu = { k: mark || 'faith', s: Game.time }; } };

// ---------- Действия ----------
Object.assign(ABIL_FX, {
  ult_warrior(h, a) {
    for (const f of abFoes(h, 5)) abStun(f, 3, h, 'С ног!', '#8ac8ff');
    ultTeamBuf(h, 9, { red: 0.5 }, a.dur, 'faith');
    let n = 0;
    for (const u of Game.units) if (u !== h && !u.dead && !u.isCourier && !u.inside && Math.hypot(u.x - h.x, u.y - h.y) < 9) { u.boostUntil = Game.time + 20; n++; }
    floater(h.x, h.y - 2.6, n ? `Стоим! (${n})` : 'Стоим!', '#8ac8ff');
    fxBurst(h.x * TILE, h.y * TILE - 10, 36, ['#ffffff', '#8ac8ff', '#2c4a9a'], 150, 30, 0.8, 2.2, 0);
    h.hfx = { k: 'fparry', t: Game.time + 0.6 };
  },
  ult_barbarian(h) {
    for (const f of abFoes(h, 4)) { abHit(f, h, 1); abStun(f, 2, h, 'Падает!', '#ff6a4a'); }
    fxBurst(h.x * TILE, h.y * TILE + 2, 44, ['#ff4a2a', '#ffb050', '#5a4020'], 170, 40, 0.9, 2.4, 200);
    h.hfx = { k: 'strike', t: Game.time + 0.5 };
  },
  ult_archer(h) {
    const f = abFoes(h, 10)[0];
    if (!f) return abNoFoe(h);          // стрелять некуда — ульта не тратится
    abFace(h, f.o);
    fxBurst(h.x * TILE, h.y * TILE - 30, 14, ['#e8d0a0', '#ffffff'], 60, 80, 0.9, 1.8, -40);
  },
  ult_rogue(h) {
    const fs = abFoes(h, 8).slice(0, 6);
    if (!fs.length) return abNoFoe(h);
    fs.forEach((f, i) => {
      abHit(f, h, 3); abStun(f, 1.5, h, i ? '' : 'Тень!', '#b49ae0');
      abBurstAt(f.o, ['#2a2038', '#6a4a98', '#c8b0e0'], 14);
    });
    abFace(h, fs[0].o); h.hfx = { k: 'strike', t: Game.time + 0.4 };
    ABIL_FX.vanish(h);
  },
  ult_mage(h) {
    const f = abFoes(h, 12)[0];
    if (!f) return abNoFoe(h);
    abList().push({ k: 'meteor', own: h.id, x: f.o.x, y: f.o.y, r: 4, s: Game.time, until: Game.time + 6.4, n: 0 });
    abFace(h, f.o); abCast(h);
    fxBurst(h.x * TILE, h.y * TILE - 20, 24, ['#fff0a0', '#ff9a30', '#e04a18'], 90, 80, 0.9, 2.2, -60);
  },
  ult_druid(h) {
    abList().push({ k: 'grove', own: h.id, x: h.x, y: h.y + 0.2, r: 5, s: Game.time, until: Game.time + 12, tick: Game.time + 0.5 });
    // поля рядом подрастают сразу на половину
    if (typeof World !== 'undefined' && World.obj) {
      const r = 8, x0 = Math.floor(h.x), y0 = Math.floor(h.y);
      for (let y = Math.max(0, y0 - r); y <= Math.min(MAP_H - 1, y0 + r); y++) for (let x = Math.max(0, x0 - r); x <= Math.min(MAP_W - 1, x0 + r); x++) {
        const i = y * MAP_W + x, o = World.obj[i];
        if (o && o.t === 'field' && o.g >= 0 && o.g < 1 && (x - x0) ** 2 + (y - y0) ** 2 <= r * r) { o.g = Math.min(1, o.g + 0.5); if (World.growing) World.growing.add(i); }
      }
    }
    abCast(h);
  },
  ult_priest(h, a, H) {
    const part = 1;
    H.hp = H.maxhp; h.injury = null;
    let n = 1;
    for (const m of abTeam(h, 10)) {
      m.injury = null; m.abbu = { k: 'mend', s: Game.time }; n++;
      if (m.rec && m.rec.hp != null) m.rec.hp = 30 + 8 * m.rec.lvl;
      if (m.hero && m.hero.maxhp) m.hero.hp = m.hero.maxhp * part;
    }
    for (const u of Game.units) {
      if (u === h || u.dead || u.inside || Math.hypot(u.x - h.x, u.y - h.y) > 10) continue;
      let ok = false;
      if (u.ill && typeof sickCure === 'function') { sickCure(u, 'priest'); ok = true; }
      if (u.injury) { u.injury = null; u.injuryUntil = 0; ok = true; }
      if (ok) { n++; floater(u.x, u.y - 1.4, 'Здоров!', '#a0ffb0'); }
    }
    for (const f of abFoes(h, 8)) { if (f.kind === 'skel') abForceKill(f, h); else if (f.kind === 'ent' && f.o.state === 'walk') { f.o.state = 'ghosted'; f.o.t = 0; f.o.gFrom = [h.x, h.y]; } }
    for (const g of Game.ghosts || []) if (Math.hypot(g.x - h.x, g.y - h.y) < 12) { g.mode = 'leave'; g.modeT = 99; }
    floater(h.x, h.y - 2.6, `Чудо! Исцелено: ${n}`, '#fff2a0');
    abCast(h);
  },
  ult_paladin(h, a) {
    abList().push({ k: 'sun', own: h.id, x: h.x, y: h.y + 0.2, r: 5, s: Game.time, until: Game.time + a.dur, tick: Game.time + 0.6 });
    ultTeamBuf(h, 8, { red: 0.4 }, a.dur, 'faith');
    abCast(h);
  },
  ult_bard(h, a) {
    for (const f of abFoes(h, 6)) abStun(f, 3, h, 'Пляшет!', '#f090d0');
    ultTeamBuf(h, 8, { atk: 0.3, red: 0.2 }, a.dur, 'faith');
    let n = 0;
    for (const g of Game.units) {
      if (g === h || g.dead || g.inside || Math.hypot(g.x - h.x, g.y - h.y) > 12) continue;
      if (!g.isCourier) g.boostUntil = Game.time + 30;
      if (g.md && typeof moodPoke === 'function') { moodPoke(g, 'osong', 8, 90); n++; }
    }
    floater(h.x, h.y - 2.6, n ? `Подпевают: ${n}` : 'Ла-ла-ла!', '#f090d0');
    h.hfx = { k: 'win0', t: Game.time + 0.6 };
  },
  ult_monk(h) {
    for (const f of abFoes(h, 3)) { abHit(f, h, 1); abStun(f, 2, h, 'Отлетел!', '#ffc070'); }
    fxBurst(h.x * TILE, h.y * TILE - 6, 40, ['#fff0d0', '#ffc070', '#ffffff'], 160, 20, 0.7, 2, 0);
    h.hfx = { k: 'strike', t: Game.time + 0.4 };
  },
});

// ---------- Зоны на земле: метеориты, роща, солнце ----------
const ULT_MET_STEP = 0.35, ULT_MET_FALL = 0.45;
function ultMetPos(z, k) {
  const an = ultRnd(z.x * 7 + k, z.y) * 6.283, rad = Math.sqrt(ultRnd(k * 3.1, z.x + z.y)) * z.r;
  return [z.x + Math.cos(an) * rad, z.y + Math.sin(an) * rad * 0.8];
}
function ultZoneTick(dt) {
  const L = Game.abz, now = Game.time;
  if (!L || !L.length || kitMirror()) return;
  for (const z of L) {
    if (!ULT_ZONES[z.k]) continue;
    const own = ultOwner(z);
    if (!own || own.dead || now > z.until) continue;
    if (z.k === 'meteor') {
      // метеорит k падает с z.s + k·шаг и ударяет через время падения
      while (now >= z.s + z.n * ULT_MET_STEP + ULT_MET_FALL && z.s + z.n * ULT_MET_STEP + ULT_MET_FALL < z.until) {
        const [px, py] = ultMetPos(z, z.n);
        z.n++;
        fxBurst(px * TILE, py * TILE - 6, 18, ['#fff0a0', '#ff9a30', '#e04a18', '#5a3a20'], 100, 70, 0.8, 2.4, 200);
        sfxAt('ultBoom', px * TILE, py * TILE, 0.8);
        for (const f of abFoes({ x: px, y: py }, 1.9)) ultBlast(f, own, 2.5, true);
      }
    } else {
      if (now < z.tick) continue;
      z.tick = now + 1;
      if (z.k === 'grove') {
        for (const f of abFoes({ x: z.x, y: z.y }, z.r)) { abStun(f, 1.6, own, '', '#8ae070'); if (Math.random() < 0.35) abHit(f, own, 1); }
        for (const m of [own, ...abTeam(own, z.r + 3)]) if (m.hero && m.hero.maxhp && Math.hypot(m.x - z.x, m.y - z.y) <= z.r) m.hero.hp = Math.min(m.hero.maxhp, m.hero.hp + m.hero.maxhp * 0.03);
        for (const u of Game.units) if (u.injury && !u.dead && !u.inside && !u.hero && Math.hypot(u.x - z.x, u.y - z.y) <= z.r && Math.random() < 0.3) { u.injury = null; u.injuryUntil = 0; floater(u.x, u.y - 1.4, 'Здоров!', '#a0ffb0'); }
        fxBurst(z.x * TILE + (Math.random() - 0.5) * z.r * TILE, z.y * TILE, 6, ['#3a8a30', '#8ae070', '#6a4a28'], 40, 30, 0.8, 1.8, -60);
      } else if (z.k === 'sun') {
        for (const f of abFoes({ x: z.x, y: z.y }, z.r)) {
          if (f.kind === 'neu') neuHit(f.o, own, neuDamageOf(own) * 0.9);
          else if (Math.random() < 0.85) ultBlast(f, own, 1, false);
        }
        for (const m of [own, ...abTeam(own, z.r + 3)]) if (m.hero && m.hero.maxhp && Math.hypot(m.x - z.x, m.y - z.y) <= z.r) m.hero.hp = Math.min(m.hero.maxhp, m.hero.hp + m.hero.maxhp * 0.035);
      }
    }
  }
}

// ---------- Рисование: зоны ----------
const ULT_DRAW_Z = {
  meteor(c, z, t) {
    const left = z.until - t, a = left < 0.8 ? Math.max(0, left / 0.8) : 1;
    c.globalCompositeOperation = 'lighter';
    // тёплое зарево на земле
    glow(c, z.x * TILE, z.y * TILE, z.r * TILE * 0.9, '255,140,50', 0.18 * a);
    const kMax = Math.floor((Math.min(t, z.until) - z.s) / ULT_MET_STEP);
    for (let k = Math.max(0, kMax - 4); k <= kMax; k++) {
      const t0 = z.s + k * ULT_MET_STEP, q = (t - t0) / ULT_MET_FALL;
      if (q < 0 || q > 1.6) continue;
      const [mx, my] = ultMetPos(z, k), px = mx * TILE, py = my * TILE;
      if (q <= 1) {
        // летит по наклонной от верхнего левого угла
        const hx = px - (1 - q) * 70, hy = py - (1 - q) * 150 - 6;
        const g = c.createLinearGradient(hx - 40, hy - 85, hx, hy);
        g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(1, `rgba(255,190,80,${0.85 * a})`);
        c.strokeStyle = g; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx - 36, hy - 80); c.lineTo(hx, hy); c.stroke();
        c.fillStyle = `rgba(255,246,208,${a})`; c.beginPath(); c.arc(hx, hy, 4.5, 0, 7); c.fill();
        c.fillStyle = `rgba(255,140,40,${0.8 * a})`; c.beginPath(); c.arc(hx, hy, 7, 0, 7); c.fill();
      } else {
        const p = (q - 1) / 0.6;
        glow(c, px, py - 4, 12 + 22 * p, '255,170,60', 0.8 * (1 - p) * a);
        c.strokeStyle = `rgba(255,220,140,${0.8 * (1 - p) * a})`; c.lineWidth = 2; c.beginPath(); c.ellipse(px, py, 6 + 20 * p, 2.5 + 8 * p, 0, 0, 7); c.stroke();
      }
    }
  },
  grove(c, z, t) {
    const left = z.until - t, a = left < 1.5 ? Math.max(0, left / 1.5) : Math.min(1, (t - z.s) / 0.6 + 0.2), px = z.x * TILE, py = z.y * TILE, r = z.r * TILE;
    const grow = Math.min(1, (t - z.s) / 0.8);
    c.globalCompositeOperation = 'lighter';
    glow(c, px, py, r, '110,230,90', 0.22 * a);
    c.globalCompositeOperation = 'source-over';
    // колючая стена из лозы по кругу: каждый зубец качается
    const N = 26;
    for (let i = 0; i < N; i++) {
      const an = i / N * 6.283 + 0.1 * Math.sin(t * 0.6), vx = px + Math.cos(an) * r * 0.92, vy = py + Math.sin(an) * r * 0.5;
      const h = (9 + 6 * ultRnd(i, 3.3)) * grow, sw = Math.sin(t * 2 + i) * 1.6;
      c.strokeStyle = `rgba(${i % 3 ? '58,138,48' : '138,224,112'},${a})`; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(vx, vy); c.quadraticCurveTo(vx + sw, vy - h * 0.55, vx + sw * 1.8, vy - h); c.stroke();
      c.fillStyle = `rgba(200,255,150,${a})`; c.fillRect(Math.round(vx + sw * 1.8) - 1, Math.round(vy - h) - 1, 2, 2);
    }
    // лепестки поднимаются из круга
    for (let i = 0; i < 7; i++) { const an = t * 0.7 + i * 0.9, rr = r * 0.7 * ultRnd(i, 5.1); abPx(c, px + Math.cos(an) * rr, py + Math.sin(an) * rr * 0.5 - ((t * 14 + i * 6) % 22), 2, i % 2 ? '#c8ff90' : '#f8ffd0', 0.8 * a); }
  },
  sun(c, z, t) {
    const left = z.until - t, a = left < 1.5 ? Math.max(0, left / 1.5) : Math.min(1, (t - z.s) / 0.5 + 0.2), px = z.x * TILE, py = z.y * TILE, r = z.r * TILE;
    c.globalCompositeOperation = 'lighter';
    glow(c, px, py, r, '255,226,120', 0.3 * a);
    c.strokeStyle = `rgba(255,232,150,${(0.6 + 0.2 * Math.sin(t * 4)) * a})`; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(px, py, r, r * 0.55, 0, 0, 7); c.stroke();
    c.beginPath(); c.ellipse(px, py, r * 0.6, r * 0.33, 0, 0, 7); c.stroke();
    // само солнце над героем: диск с лучами
    const sy = py - 62 - 4 * Math.sin(t * 2), sr = 11 + 1.5 * Math.sin(t * 5);
    glow(c, px, sy, 34, '255,220,110', 0.55 * a);
    c.fillStyle = `rgba(255,248,200,${a})`; c.beginPath(); c.arc(px, sy, sr, 0, 7); c.fill();
    c.strokeStyle = `rgba(255,236,150,${0.9 * a})`; c.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283 + t * 0.9, r0 = sr + 3, r1 = sr + 8 + 4 * (i % 2); c.beginPath(); c.moveTo(px + Math.cos(an) * r0, sy + Math.sin(an) * r0); c.lineTo(px + Math.cos(an) * r1, sy + Math.sin(an) * r1); c.stroke(); }
    // лучи вниз на землю
    const g = c.createLinearGradient(0, sy, 0, py);
    g.addColorStop(0, `rgba(255,240,170,${0.5 * a})`); g.addColorStop(1, 'rgba(255,240,170,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(px - 6, sy + 6); c.lineTo(px + 6, sy + 6); c.lineTo(px + r * 0.5, py); c.lineTo(px - r * 0.5, py); c.closePath(); c.fill();
    for (let i = 0; i < 10; i++) { const an = t * 0.8 + i * 0.63, rr = r * 0.8; abPx(c, px + Math.cos(an) * rr, py + Math.sin(an) * rr * 0.55 - ((t * 22 + i * 7) % 14), 2, '#fff6c0', 0.85 * a); }
  },
};
{
  const _adz = abDrawZone;
  abDrawZone = function (c, z, t) {
    const f = ULT_DRAW_Z[z.k];
    if (!f) return _adz(c, z, t);
    c.save(); f(c, z, t); c.restore();
  };
}

// ---------- Рисование: вспышка в момент ульты (1,1 с) и свечение, пока действует ----------
const ULT_BURST = {
  ult_warrior(c, px, py, p) {
    // щиты встают дугой и растёт синее кольцо
    for (let i = 0; i < 9; i++) {
      const an = Math.PI + i / 8 * Math.PI, r = 20 + 14 * Math.min(1, p * 3), sx = px + Math.cos(an) * r * 1.5, sy = py - 4 + Math.sin(an) * r * 0.55;
      c.fillStyle = `rgba(122,160,255,${0.9 * (1 - p)})`; c.fillRect(Math.round(sx) - 3, Math.round(sy) - 5, 6, 9);
      c.fillStyle = `rgba(246,212,88,${0.9 * (1 - p)})`; c.fillRect(Math.round(sx) - 3, Math.round(sy) - 5, 6, 1); c.fillRect(Math.round(sx) - 1, Math.round(sy) - 4, 2, 7);
    }
    c.strokeStyle = `rgba(190,225,255,${0.8 * (1 - p)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(px, py + 4, 20 + 90 * p, 8 + 36 * p, 0, 0, 7); c.stroke();
  },
  ult_barbarian(c, px, py, p) {
    for (let i = 0; i < 4; i++) { const q = (p * 1.6 + i / 4) % 1; c.strokeStyle = `rgba(255,80,50,${0.8 * (1 - q)})`; c.lineWidth = 2.5; c.beginPath(); c.ellipse(px, py + 4, 10 + 80 * q, 4 + 32 * q, 0, 0, 7); c.stroke(); }
    for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283; const r = 8 + 60 * p; c.fillStyle = `rgba(255,${120 + (i % 3) * 40},40,${0.9 * (1 - p)})`; c.fillRect(Math.round(px + Math.cos(an) * r), Math.round(py - 8 + Math.sin(an) * r * 0.45 - 20 * p), 3, 3); }
  },
  ult_archer(c, px, py, p) {
    // 14 стрел падают сверху по наклону
    for (let i = 0; i < 14; i++) {
      const q = Math.max(0, Math.min(1, p * 1.6 - ultRnd(i, 1.7) * 0.6));
      if (q <= 0 || q >= 1) continue;
      const tx = px + (ultRnd(i, 2.3) - 0.5) * 150, ty = py + (ultRnd(i, 4.1) - 0.5) * 50, x = tx - (1 - q) * 30, y = ty - (1 - q) * 120;
      c.strokeStyle = `rgba(232,208,160,${0.95})`; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 4, y - 16); c.lineTo(x, y); c.stroke();
      c.fillStyle = '#e04a3a'; c.fillRect(Math.round(x - 5), Math.round(y - 18), 2, 2); c.fillStyle = '#ffffff'; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
  },
  ult_rogue(c, px, py, p) {
    // тёмные росчерки клинков из одной точки
    for (let i = 0; i < 10; i++) {
      const an = ultRnd(i, 6.7) * 6.283, r0 = 6 + 16 * p, r1 = r0 + 22 * (1 - p) + 6;
      c.strokeStyle = `rgba(${i % 2 ? '60,40,100' : '200,180,240'},${0.9 * (1 - p)})`; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(px + Math.cos(an) * r0, py - 10 + Math.sin(an) * r0 * 0.6); c.lineTo(px + Math.cos(an) * r1, py - 10 + Math.sin(an) * r1 * 0.6); c.stroke();
    }
  },
  ult_mage(c, px, py, p) {
    // руны сходятся над головой, огненное кольцо
    for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283 + p * 4, r = 24 * (1 - p) + 4; abPx(c, px + Math.cos(an) * r - 1, py - 40 + Math.sin(an) * r * 0.5, 3, i % 2 ? '#fff0a0' : '#ff9a30', 0.95); }
    c.strokeStyle = `rgba(255,150,50,${0.8 * (1 - p)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(px, py + 4, 14 + 40 * p, 6 + 16 * p, 0, 0, 7); c.stroke();
  },
  ult_druid(c, px, py, p) {
    for (let i = 0; i < 16; i++) { const an = i / 16 * 6.283 + p * 3, r = 10 + 70 * p; c.fillStyle = i % 2 ? `rgba(138,224,112,${1 - p})` : `rgba(58,138,48,${1 - p})`; c.beginPath(); c.ellipse(px + Math.cos(an) * r, py - 4 + Math.sin(an) * r * 0.5 - 18 * p, 3, 1.5, an, 0, 7); c.fill(); }
  },
  ult_priest(c, px, py, p) {
    // столб света во весь рост и кольца исцеления
    const g = c.createLinearGradient(0, py - 150, 0, py + 6);
    g.addColorStop(0, 'rgba(255,248,200,0)'); g.addColorStop(0.6, `rgba(255,248,190,${0.75 * (1 - p)})`); g.addColorStop(1, 'rgba(255,255,230,0)');
    const w = 14 + 10 * Math.sin(p * 3.14);
    c.fillStyle = g; c.fillRect(px - w, py - 150, w * 2, 156);
    for (let i = 0; i < 3; i++) { const q = (p * 1.5 + i / 3) % 1; c.strokeStyle = `rgba(255,240,160,${0.8 * (1 - q)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(px, py + 4, 10 + 120 * q, 4 + 52 * q, 0, 0, 7); c.stroke(); }
    for (let i = 0; i < 10; i++) { const an = i * 0.63 + p * 4, r = 10 + 40 * p; const x = px + Math.cos(an) * r, y = py - 6 - p * 50 - i * 3; c.fillStyle = `rgba(255,255,220,${0.9 * (1 - p)})`; c.fillRect(x - 0.6, y - 2, 1.2, 4); c.fillRect(x - 2, y - 0.6, 4, 1.2); }
  },
  ult_paladin(c, px, py, p) {
    glow(c, px, py - 60 * Math.min(1, p * 2), 30, '255,220,110', 0.7 * (1 - p));
    for (let i = 0; i < 14; i++) { const an = i / 14 * 6.283; c.strokeStyle = `rgba(255,236,150,${0.8 * (1 - p)})`; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px + Math.cos(an) * 8, py - 12 + Math.sin(an) * 8); c.lineTo(px + Math.cos(an) * (14 + 60 * p), py - 12 + Math.sin(an) * (14 + 60 * p) * 0.8); c.stroke(); }
  },
  ult_bard(c, px, py, p) {
    // ноты разлетаются по кругу
    for (let i = 0; i < 10; i++) {
      const an = i / 10 * 6.283, r = 10 + 70 * p, x = px + Math.cos(an) * r, y = py - 16 + Math.sin(an) * r * 0.5 - 24 * p;
      c.fillStyle = `rgba(${i % 2 ? '240,144,208' : '255,208,112'},${1 - p})`; c.beginPath(); c.ellipse(x, y, 2.4, 1.8, -0.4, 0, 7); c.fill(); c.fillRect(Math.round(x + 1.6), Math.round(y - 7), 1, 7);
      if (i % 3 === 0) c.fillRect(Math.round(x + 1.6), Math.round(y - 7), 4, 1);
    }
  },
  ult_monk(c, px, py, p) {
    // кулаки-вспышки ложатся кругом
    for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283 + p * 2, r = 12 + 26 * p; glow(c, px + Math.cos(an) * r, py - 10 + Math.sin(an) * r * 0.55, 8, '255,200,110', 0.8 * (1 - p)); }
    c.strokeStyle = `rgba(255,224,170,${0.9 * (1 - p)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(px, py + 4, 8 + 60 * p, 3 + 24 * p, 0, 0, 7); c.stroke();
  },
};
const ULT_AURA = {
  ult_warrior(c, px, py, t, fade) {
    // сверкающий купол и вращающиеся щиты
    c.fillStyle = `rgba(122,180,255,${0.09 * fade})`; c.beginPath(); c.ellipse(px, py - 10, 22, 26, 0, 0, 7); c.fill();
    c.strokeStyle = `rgba(190,225,255,${0.6 * fade})`; c.lineWidth = 1; c.stroke();
    for (let i = 0; i < 3; i++) { const an = t * 1.6 + i * 2.09; c.fillStyle = `rgba(246,212,88,${0.9 * fade})`; c.fillRect(Math.round(px + Math.cos(an) * 20) - 2, Math.round(py - 10 + Math.sin(an) * 22) - 3, 4, 6); }
  },
  ult_barbarian(c, px, py, t, fade) {
    glow(c, px, py - 14, 26 + 3 * Math.sin(t * 10), '255,60,30', 0.4 * fade);
    for (let i = 0; i < 5; i++) { const q = (t * 1.4 + i * 0.2) % 1; abPx(c, px + (ultRnd(i, Math.floor(t * 1.4 + i * 0.2)) - 0.5) * 22, py - 6 - q * 34, 2, i % 2 ? '#ff9a40' : '#ffe070', 0.9 * (1 - q) * fade); }
  },
  ult_rogue(c, px, py, t, fade) {
    c.fillStyle = `rgba(20,16,30,${0.45 * fade})`; c.beginPath(); c.ellipse(px, py + 6, 16, 5, 0, 0, 7); c.fill();
    for (let i = 0; i < 4; i++) { const an = t * 5 + i * 1.57; abPx(c, px + Math.cos(an) * 12, py - 10 + Math.sin(an) * 7, 2, i % 2 ? '#6a4a98' : '#c8b0e0', 0.9 * fade); }
  },
  ult_paladin(c, px, py, t, fade) {
    c.strokeStyle = `rgba(255,232,140,${0.9 * fade})`; c.lineWidth = 1.6; c.beginPath(); c.ellipse(px, py - 46 + Math.sin(t * 3), 8, 2.5, 0, 0, 7); c.stroke();
    glow(c, px, py - 12, 20, '255,226,120', 0.28 * fade);
  },
  ult_bard(c, px, py, t, fade) {
    for (let i = 0; i < 5; i++) {
      const q = (t * 0.7 + i * 0.2) % 1, x = px + Math.sin(t * 2 + i * 1.7) * 16, y = py - 18 - q * 44;
      c.fillStyle = `rgba(${i % 2 ? '240,144,208' : '255,208,112'},${(1 - q) * fade})`; c.beginPath(); c.ellipse(x, y, 2.2, 1.6, -0.4, 0, 7); c.fill(); c.fillRect(Math.round(x + 1.4), Math.round(y - 6), 1, 6);
    }
  },
  ult_monk(c, px, py, t, fade) {
    for (let i = 0; i < 5; i++) { const yy = py - 4 - i * 6 + Math.sin(t * 17 + i) * 1.4, len = 8 + ((t * 40 + i * 9) % 10); c.strokeStyle = `rgba(255,208,128,${0.6 * fade})`; c.lineWidth = 1; c.beginPath(); c.moveTo(px - 8, yy); c.lineTo(px - 8 - len, yy); c.moveTo(px + 8, yy); c.lineTo(px + 8 + len, yy); c.stroke(); }
    for (let i = 0; i < 4; i++) { const an = t * 12 + i * 1.57; glow(c, px + Math.cos(an) * 14, py - 12 + Math.sin(an) * 8, 6, '255,200,110', 0.7 * fade); }
  },
};
{
  const _b = drawAbilBurst;
  drawAbilBurst = function (c, u, k, p) {
    _b(c, u, k, p);
    const f = ULT_BURST[k];
    if (!f) return;
    // большие кольца ульты видны далеко: свечение от земли на весь размах
    c.save(); c.globalCompositeOperation = 'lighter'; f(c, u.x * TILE, u.y * TILE, p); c.restore();
  };
  const _a = drawAbilAura;
  drawAbilAura = function (c, u, k, el, left) {
    const f = ULT_AURA[k];
    if (!f) return _a(c, u, k, el, left);
    const fade = left < 2 ? (Math.floor(Game.time * 8) % 2 ? 0.4 : 1) : 1;
    c.save(); c.globalCompositeOperation = 'lighter'; f(c, u.x * TILE, u.y * TILE, Game.time, fade); c.restore();
  };
  // сам герой: тень танца почти прозрачна, тысяча ударов двоит силуэт, гнев предков крупнее
  const _du = drawUnit;
  drawUnit = function (c, u) {
    const fx = u.abfx;
    if (!fx || !(fx.t > Game.time) || u.inside || u.dead) return _du(c, u);
    const k = fx.k, t = Game.time;
    if (k === 'ult_rogue') { c.save(); c.globalAlpha = 0.32 + 0.08 * Math.sin(t * 7); _du(c, u); c.restore(); return; }
    if (k === 'ult_barbarian') {
      const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6), sc = 1.14 + 0.02 * Math.sin(t * 8);
      c.save(); c.translate(px, py); c.scale(sc, sc); c.translate(-px, -py); _du(c, u); c.restore(); return;
    }
    if (k === 'ult_monk') {
      const dx = (u.face || 1) * -4;
      for (const [o, a] of [[3, 0.14], [2, 0.22], [1, 0.32]]) { c.save(); c.globalAlpha = a; c.translate(dx * o + Math.sin(t * 21 + o) * 1.2, 0); _du(c, u); c.restore(); }
    }
    _du(c, u);
  };
}

// ---------- Подключение ----------
{
  const _z = abZoneTick;
  abZoneTick = function (dt) { _z(dt); ultZoneTick(dt); };
}
// стиль кнопки ульты в карточке героя (панель на экране — в heroabil.js)
if (typeof document !== 'undefined' && document.createElement && document.head && document.head.appendChild) {
  const st = document.createElement('style');
  st.textContent = '#hero-card .hs.ult{border-color:#b070ff;box-shadow:0 0 6px rgba(176,112,255,.55)}.hk-big.ult,.hk-ab.ult{border-color:#b070ff}';
  document.head.appendChild(st);
}
