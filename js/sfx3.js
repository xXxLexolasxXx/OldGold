'use strict';
// Голоса и шорохи лесной живности (fauna.js, fauna2.js): вороны, лягушки, червяки, светлячки, мыши, барсук,
// белки, дятлы, кроты, ежи, прогон гусей. Только собственный синтез на кирпичиках sfx.js.
// Подключается после fauna*.js: заменяет привязку всплывающих надписей, остальное зовётся sfxAt(...) прямо из fauna.

// Хриплый голос: пила через форманту, с амплитудной «дрожью» (рваный тембр); f — центр форманты
function rasp(d, t, f0, f1, len, vol, formant, am = 70, depth = 0.6) {
  const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
  bp.type = 'bandpass'; bp.frequency.value = formant; bp.Q.value = 2.5;
  g.gain.value = 1 - depth * 0.5; l.frequency.value = am; lg.gain.value = depth * 0.5; l.connect(lg); lg.connect(g.gain);
  bp.connect(g); g.connect(d);
  tone(bp, 'sawtooth', f0, f1, t, len, vol, 0.012);
  l.start(t); l.stop(t + len + 0.03);
}

// Серия коротких шумовых щелчков/шорохов [(время, фильтр, частота, длина, громкость)]
function scuffs(d, t, n, gap, type, f, len, vol) {
  for (let k = 0; k < n; k++) noiseHit(d, type, f * (0.8 + Math.random() * 0.5), f * 0.7, 1.2, t + k * gap + Math.random() * gap * 0.5, len, vol * (0.5 + Math.random() * 0.5), 0.004);
}

Object.assign(SFX, {
  // ворона: сухое «кар» — один-два раза
  caw: (d, t, v) => {
    const r = 0.9 + v * 0.2, n = v > 0.55 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const tt = t + k * 0.28;
      rasp(d, tt, 430 * r, 290 * r, 0.22, 0.5, 1100, 65, 0.55);
      noiseHit(d, 'bandpass', 1400, 900, 2, tt, 0.18, 0.12, 0.01);
    }
  },
  // ворона, испуганная: низкий хриплый крик, срывается вверх
  cawRasp: (d, t, v) => {
    rasp(d, t, 300 + v * 40, 520, 0.36, 0.55, 900, 55, 0.8);
    noiseHit(d, 'bandpass', 1800, 1000, 1.5, t, 0.3, 0.2, 0.02);
  },
  // взмахи крыльев при взлёте: хлопки с затуханием
  wingFlap: (d, t, v) => {
    for (let k = 0; k < 4; k++) {
      const tt = t + k * (0.11 + k * 0.02), a = 1 - k * 0.15;
      noiseHit(d, 'bandpass', 600 + k * 80, 280, 0.9, tt, 0.1, 0.5 * a, 0.012);
      tone(d, 'sine', 140, 80, tt, 0.07, 0.18 * a, 0.006);
    }
  },
  // гусиные крылья: крупнее и дольше
  gooseFlap: (d, t, v) => {
    for (let k = 0; k < 6; k++) {
      const tt = t + k * 0.1 + Math.random() * 0.03, a = 1 - k * 0.1;
      noiseHit(d, 'bandpass', 450, 220, 0.8, tt, 0.14, 0.6 * a, 0.015);
      tone(d, 'sine', 110, 65, tt, 0.1, 0.22 * a, 0.008);
    }
  },
  // «кыш!» — гномий окрик и свист воздуха
  shoo: (d, t, v) => {
    gnomeVoice(d, t, [[330 + v * 40, 360, 0.09], [360, 250, 0.2]], 0.5, 1000);
    noiseHit(d, 'highpass', 3200, 5200, 0.8, t + 0.12, 0.28, 0.25, 0.03);
  },
  // лягушка: «ква» — пульсирующий низкий тон
  ribbit: (d, t, v) => {
    const r = 0.88 + v * 0.24, ctx = Sfx.ctx;
    for (let k = 0; k < 2; k++) {
      const tt = t + k * 0.17, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.connect(d);
      rasp(lp, tt, 210 * r, 150 * r, 0.14, 0.45, 700, 40, 0.8);
    }
  },
  // прыжок: шлёпок лапок и короткий «пшик»
  frogHop: (d, t, v) => {
    tone(d, 'sine', 320 + v * 60, 170, t, 0.05, 0.25, 0.004);
    noiseHit(d, 'bandpass', 900, 500, 1.2, t, 0.05, 0.18, 0.003);
  },
  // плюх в воду: удар, всплеск и пузырёк
  splash: (d, t, v) => {
    noiseHit(d, 'lowpass', 1800, 300, 0.7, t, 0.3, 0.5, 0.004);
    noiseHit(d, 'bandpass', 2400, 1200, 1.5, t + 0.02, 0.18, 0.2, 0.01);
    tone(d, 'sine', 260, 640 + v * 200, t + 0.07, 0.1, 0.18, 0.01);
    tone(d, 'sine', 400, 900, t + 0.15, 0.07, 0.1, 0.01);
  },
  // червяк: еле слышное скольжение по мокрому
  wormSlither: (d, t) => breath(d, t, 0.5, 700, 300, 0.08, 0.2),
  // чавк, когда курица клюёт червя
  squelch: (d, t, v) => {
    noiseHit(d, 'bandpass', 700, 320, 2.5, t, 0.08, 0.4, 0.004);
    tone(d, 'sine', 190 + v * 40, 90, t, 0.07, 0.3, 0.004);
    tone(d, 'sine', 140, 260, t + 0.07, 0.05, 0.14, 0.004);
  },
  // светлячок: хрустальный, едва слышный «звяк»
  firefly: (d, t, v) => {
    const f = 2600 + v * 1800;
    modal(d, t, [[f, 1, 0.55], [f * 1.5, 0.35, 0.35], [f * 2.4, 0.15, 0.2]], 0.07, 0.01);
    modal(d, t + 0.16, [[f * 1.25, 0.6, 0.4]], 0.05, 0.01);
  },
  // мышь: два тонких писка
  mousePip: (d, t, v) => {
    tone(d, 'sine', 4300 + v * 700, 5600, t, 0.05, 0.3, 0.004);
    tone(d, 'sine', 4900, 3800 + v * 400, t + 0.075, 0.07, 0.25, 0.004);
  },
  // мышиный шорох по соломе
  mouseRustle: (d, t) => scuffs(d, t, 6, 0.045, 'bandpass', 4200, 0.03, 0.18),
  // грызёт мешок: частое мелкое поскрёбывание
  mouseGnaw: (d, t) => {
    scuffs(d, t, 7, 0.05, 'bandpass', 3200, 0.02, 0.25);
    breath(d, t, 0.35, 2500, 1800, 0.05, 0.05);
  },
  // барсук роет: глухие взмахи лапы, комья земли
  badgerDig: (d, t, v) => {
    for (let k = 0; k < 2; k++) {
      const tt = t + k * 0.18;
      noiseHit(d, 'lowpass', 900, 250, 0.7, tt, 0.16, 0.5, 0.02);
      tone(d, 'sine', 110, 60, tt + 0.02, 0.09, 0.2, 0.01);
      scuffs(d, tt + 0.06, 3, 0.03, 'bandpass', 1800, 0.025, 0.14);
    }
  },
  // барсук фыркает
  badgerSnort: (d, t, v) => {
    for (let k = 0; k < 2; k++) noiseHit(d, 'bandpass', 500 + v * 150, 260, 1.1, t + k * 0.14, 0.12, 0.5, 0.012);
  },
  // барсук рычит, напуганный
  badgerGrowl: (d, t, v) => {
    const ctx = Sfx.ctx, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(d);
    rasp(lp, t, 78 + v * 10, 58, 0.55, 0.8, 300, 32, 0.9);
    noiseHit(d, 'bandpass', 700, 400, 1.2, t, 0.4, 0.28, 0.04);
  },
  // белка цокает: серия резких щелчков
  squirrelChatter: (d, t, v) => {
    const n = 5 + ((v * 3) | 0);
    for (let k = 0; k < n; k++) {
      const tt = t + k * 0.052, f = 2300 + (k & 1) * 500 + v * 200;
      tone(d, 'square', f, f * 0.7, tt, 0.022, 0.1, 0.002);
      noiseHit(d, 'bandpass', f * 1.4, f, 4, tt, 0.015, 0.1, 0.001);
    }
  },
  // белка щёлкает орех: сухой треск скорлупы
  squirrelCrack: (d, t, v) => {
    noiseHit(d, 'bandpass', 2600, 1600, 3, t, 0.025, 0.45, 0.001);
    modal(d, t, [[1700 + v * 300, 0.6, 0.05], [3100, 0.3, 0.03]], 0.3, 0.001);
    scuffs(d, t + 0.05, 3, 0.03, 'highpass', 4000, 0.02, 0.12);
  },
  // шорох когтей по коре
  barkRustle: (d, t) => scuffs(d, t, 7, 0.035, 'bandpass', 2400, 0.03, 0.2),
  // дятел: очередь «тук-тук-тук» по стволу
  peckDrum: (d, t, v) => {
    const n = 4 + ((v * 4) | 0), gap = 0.062 + v * 0.01;
    for (let k = 0; k < n; k++) {
      const tt = t + k * gap, a = 0.85 + Math.random() * 0.3;
      noiseHit(d, 'bandpass', 1800, 1200, 2, tt, 0.012, 0.4 * a, 0.001);
      modal(d, tt, [[620 * (0.97 + Math.random() * 0.06), 0.8, 0.06], [1250, 0.4, 0.04], [2100, 0.15, 0.025]], 0.36 * a, 0.001);
    }
  },
  // посвист дятла: два звонких «кью-кью»
  peckWhistle: (d, t, v) => {
    const f = 1900 + v * 300;
    tone(d, 'sine', f, f * 1.5, t, 0.11, 0.3, 0.01);
    tone(d, 'sine', f * 1.1, f * 1.6, t + 0.17, 0.11, 0.26, 0.01);
    tone(d, 'sine', f * 2, f * 3, t, 0.11, 0.05, 0.01);
  },
  // крот: шорох земли — низкий, с осыпью
  moleRustle: (d, t, v) => {
    noiseHit(d, 'lowpass', 600, 220, 0.8, t, 0.5, 0.4, 0.12);
    scuffs(d, t + 0.1, 4, 0.07, 'bandpass', 1200, 0.03, 0.16);
  },
  // крот пискнул, высунувшись
  molePeep: (d, t, v) => {
    tone(d, 'sine', 2600 + v * 400, 3500, t, 0.07, 0.25, 0.006);
    tone(d, 'sine', 3000, 2400, t + 0.1, 0.06, 0.18, 0.006);
  },
  // ёж фыркает
  hogSnort: (d, t, v) => {
    for (let k = 0; k < 2; k++) {
      noiseHit(d, 'bandpass', 1500 + v * 300, 800, 1.2, t + k * 0.1, 0.09, 0.45, 0.008);
      tone(d, 'sawtooth', 230, 160, t + k * 0.1, 0.07, 0.07, 0.01);
    }
  },
  // иголки шуршат при сворачивании в клубок
  hogSpines: (d, t) => {
    scuffs(d, t, 12, 0.025, 'highpass', 5000, 0.015, 0.2);
    noiseHit(d, 'bandpass', 3000, 1800, 1, t, 0.3, 0.12, 0.05);
  },
});

Object.assign(SFX_DEF, {
  caw:      { pri: 1, gain: 0.7,  poly: 2, cd: 0.4,  len: 0.6 },
  cawRasp:  { pri: 2, gain: 0.7,  poly: 2, cd: 0.5,  len: 0.45 },
  wingFlap: { pri: 1, gain: 0.45, poly: 2, cd: 0.3,  len: 0.55 },
  gooseFlap: { pri: 1, gain: 0.5, poly: 2, cd: 0.4,  len: 0.8 },
  shoo:     { pri: 2, gain: 0.45, poly: 2, cd: 0.6,  len: 0.5 },
  ribbit:   { pri: 1, gain: 0.65,  poly: 2, cd: 0.25, len: 0.45 },
  frogHop:  { pri: 0, gain: 0.35, poly: 2, cd: 0.15, len: 0.1 },
  splash:   { pri: 1, gain: 0.5,  poly: 2, cd: 0.2,  len: 0.35 },
  wormSlither: { pri: 0, gain: 0.3, poly: 1, cd: 1.5, len: 0.7 },
  squelch:  { pri: 1, gain: 0.45, poly: 2, cd: 0.15, len: 0.2 },
  firefly:  { pri: 0, gain: 0.35, poly: 2, cd: 0.8,  len: 0.8, wet: 0.35 },
  mousePip: { pri: 1, gain: 0.35, poly: 2, cd: 0.25, len: 0.2 },
  mouseRustle: { pri: 0, gain: 0.4, poly: 1, cd: 0.8, len: 0.35 },
  mouseGnaw: { pri: 0, gain: 0.4, poly: 1, cd: 0.9,  len: 0.4 },
  badgerDig: { pri: 1, gain: 0.5, poly: 1, cd: 0.45, len: 0.45 },
  badgerSnort: { pri: 1, gain: 0.45, poly: 1, cd: 0.8, len: 0.3 },
  badgerGrowl: { pri: 2, gain: 0.55, poly: 1, cd: 1.2, len: 0.7 },
  squirrelChatter: { pri: 1, gain: 0.65, poly: 2, cd: 0.6, len: 0.4 },
  squirrelCrack: { pri: 0, gain: 0.7, poly: 2, cd: 0.5, len: 0.15 },
  barkRustle: { pri: 0, gain: 0.4, poly: 2, cd: 0.4, len: 0.3 },
  peckDrum: { pri: 1, gain: 0.5,  poly: 2, cd: 1.0,  len: 0.6 },
  peckWhistle: { pri: 1, gain: 0.4, poly: 1, cd: 1.5, len: 0.35 },
  moleRustle: { pri: 0, gain: 0.45, poly: 2, cd: 0.8, len: 0.6 },
  molePeep: { pri: 1, gain: 0.35, poly: 2, cd: 0.5,  len: 0.2 },
  hogSnort: { pri: 1, gain: 0.4,  poly: 1, cd: 0.8,  len: 0.3 },
  hogSpines: { pri: 0, gain: 0.4, poly: 1, cd: 0.8,  len: 0.4 },
});

// Всплывающие надписи → звуки (после fauna*.js, чтобы заменить временные 'honk' и 'cluck')
Object.assign(FLOAT_SFX, {
  'Кар!': 'caw', 'Ква!': 'ribbit', 'Ам!': 'squelch', 'Пи!': 'mousePip', 'Фр-р!': 'badgerGrowl',
  'Фыр!': 'hogSnort', 'Кыш!': 'shoo',
});

// Мировые координаты в клетках → sfxAt
function faunaSfx(kind, x, y, vel = 1, delay = 0) { sfxAt(kind, x * TILE, y * TILE, vel, delay); }
