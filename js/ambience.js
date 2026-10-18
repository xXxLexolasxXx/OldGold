'use strict';
// Живой фон: птицы днём, совы и жуть ночью, спуск тумана на деревню.
// Всё редкое и вразнобой (раз в десятки секунд), чтобы не надоедало: у каждого вида свой интервал,
// одно и то же подряд не повторяется. Тайминг идёт по реальным секундам, а не по скорости игры.
// Подключается после sfx2.js (использует его кирпичики tone/noiseHit/modal/breath и таблицы SFX/SFX_DEF).

Object.assign(SFX_DEF, {
  tweet:  { pri: 0, gain: 0.55, poly: 2, cd: 0.4, len: 0.6 },
  trill:  { pri: 0, gain: 0.55, poly: 1, cd: 1, len: 0.6 },
  warble: { pri: 0, gain: 0.55, poly: 1, cd: 1, len: 1.2 },
  coo:    { pri: 0, gain: 0.42, poly: 1, cd: 2, len: 1.4, wet: 0.2 },
  cuckoo: { pri: 0, gain: 0.4, poly: 1, cd: 2, len: 1.6, wet: 0.3 },
  howl:   { pri: 1, gain: 0.7, poly: 1, cd: 5, len: 3.8, wet: 0.65 },
  bell:   { pri: 1, gain: 0.55, poly: 1, cd: 5, len: 4.5, wet: 0.6 },
  whisper: { pri: 1, gain: 0.85, poly: 1, cd: 5, len: 2.8, wet: 0.55 },
  gust:   { pri: 1, gain: 0.75, poly: 1, cd: 5, len: 3.6, wet: 0.5 },
  hootFar: { pri: 0, gain: 0.3, poly: 1, cd: 1, len: 1.2, wet: 0.6 },
});

Object.assign(SFX, {
  // чирик: два-три быстрых росчерка вверх-вниз
  tweet: (d, t, v) => {
    const f = 3000 + v * 1800, n = 2 + ((v * 7) | 0) % 2;
    for (let k = 0; k < n; k++) { const tt = t + k * 0.11; tone(d, 'sine', f, f * 1.35, tt, 0.045, 0.3, 0.006); tone(d, 'sine', f * 1.35, f * 0.9, tt + 0.045, 0.045, 0.28, 0.004); }
  },
  // трель: частая дробь одной высоты с лёгким дрожанием
  trill: (d, t, v) => {
    const f = 2600 + v * 1400, n = 8 + ((v * 9) | 0);
    for (let k = 0; k < n; k++) tone(d, 'sine', f * (k % 2 ? 1.08 : 1), f * (k % 2 ? 1.0 : 1.1), t + k * 0.04, 0.03, 0.22, 0.004);
  },
  // певчая птица: короткая попевка из 5–7 нот разной высоты
  warble: (d, t, v) => {
    const n = 5 + ((v * 11) | 0) % 3;
    let tt = t, f = 2200 + v * 1400;
    for (let k = 0; k < n; k++) {
      const nf = Math.max(1800, Math.min(5200, f * (0.78 + Math.random() * 0.5))), len = 0.07 + Math.random() * 0.08;
      tone(d, 'sine', f, nf, tt, len, 0.26, 0.012); f = nf; tt += len * 1.15;
    }
  },
  // горлица: «ку-ку-руу» низкими мягкими нотами
  coo: (d, t, v) => {
    const f = 400 + v * 60;
    for (const [k, len, m] of [[0, 0.16, 1.05], [0.22, 0.16, 1.05], [0.46, 0.5, 0.95]]) {
      const o = tone(d, 'sine', f * m * 1.12, f * m, t + k, len, 0.5, 0.04);
      const lfo = Sfx.ctx.createOscillator(), lg = Sfx.ctx.createGain(); lfo.frequency.value = 6; lg.gain.value = 5; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + k); lfo.stop(t + k + len + 0.03);
      tone(d, 'sine', f * m * 2, f * m * 1.95, t + k, len, 0.08, 0.04);
    }
  },
  // кукушка: «ку-ку», малая терция вниз
  cuckoo: (d, t, v) => {
    const f = 720 + v * 80, reps = v > 0.6 ? 3 : 2;
    for (let k = 0; k < reps; k++) {
      tone(d, 'sine', f * 1.02, f, t + k * 0.5, 0.2, 0.55, 0.02);
      tone(d, 'sine', f * 0.84, f * 0.83, t + k * 0.5 + 0.23, 0.26, 0.5, 0.025);
      tone(d, 'sine', f * 2, f * 1.98, t + k * 0.5, 0.2, 0.06, 0.02);
    }
  },
  // далёкий вой: плывущий голос через форманту, с дыханием
  howl: (d, t, v) => {
    const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 3; bp.connect(d);
    const f = 290 + v * 50;
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.85, t); o.frequency.exponentialRampToValueAtTime(f * 1.7, t + 1.1); o.frequency.setValueAtTime(f * 1.7, t + 1.4); o.frequency.exponentialRampToValueAtTime(f * 1.05, t + 3.2);
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.03, t + 1.6); lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.7); g.gain.setValueAtTime(0.5, t + 1.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    o.connect(g); g.connect(bp); o.start(t); lfo.start(t); o.stop(t + 3.5); lfo.stop(t + 3.5);
    breath(d, t, 3.2, 1500, 700, 0.05, 0.8);
  },
  // колокол вдалеке: глухой удар, два раза
  bell: (d, t, v) => {
    const r = 0.95 + v * 0.1;
    for (const k of [0, 2.3]) modal(d, t + k, [[110 * r, 0.6, 3.6], [220 * r, 1, 3], [264 * r, 0.5, 2.5], [330 * r, 0.3, 1.8], [590 * r, 0.15, 1.1]], 0.3 - k * 0.04, 0.004);
  },
  // шёпот: несколько слогов шипящего придыхания без слов
  whisper: (d, t, v) => {
    let tt = t;
    const n = 4 + ((v * 9) | 0) % 3;
    for (let k = 0; k < n; k++) {
      const len = 0.14 + Math.random() * 0.18, f = 1700 + Math.random() * 1500;
      noiseHit(d, 'bandpass', f, f * (0.7 + Math.random() * 0.6), 4, tt, len, 0.28 - k * 0.025, 0.04);
      tt += len + 0.05 + Math.random() * 0.2;
    }
    breath(d, t, 2.2, 600, 300, 0.06, 0.8);
  },
  // порыв: тонкий свист сквозняка, плывущий вверх и вниз, с низким стоном
  gust: (d, t, v) => {
    const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9; bp.connect(d);
    bp.frequency.setValueAtTime(280 + v * 80, t); bp.frequency.linearRampToValueAtTime(620, t + 1.5); bp.frequency.linearRampToValueAtTime(240, t + 3.2);
    noiseHit(bp, 'lowpass', 3000, 3000, 0.5, t, 3.3, 1.1, 1);
    tone(d, 'sine', 150, 120, t + 0.3, 2.6, 0.06, 1);
  },
  // эхо совы: далёкое тихое «у-ху»
  hootFar: (d, t, v) => {
    const r = 0.88 + v * 0.1;
    tone(d, 'sine', 400 * r, 365 * r, t, 0.3, 0.4, 0.06); breath(d, t, 0.25, 900, 500, 0.05, 0.05);
    tone(d, 'sine', 385 * r, 330 * r, t + 0.42, 0.5, 0.36, 0.08);
  },
});

// Спуск тумана: низкий гул растёт, шум тянется над землёй, далёкий колокол и холодные созвучия — на 9 секунд
function sfxFogDescend() {
  if (!Sfx.ctx || !Sfx.on || !Sfx.out || Sfx.ctx.state !== 'running' || document.hidden) return;
  const ctx = Sfx.ctx, t = ctx.currentTime + 0.1, len = 9;
  const o = ctx.createGain(); o.gain.value = 0.8; o.connect(Sfx.out);
  if (Sfx.verb) { const wg = ctx.createGain(); wg.gain.value = 0.5; o.connect(wg); wg.connect(Sfx.verb); }
  const swell = (peak, a, b) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + b); g.gain.exponentialRampToValueAtTime(0.0001, t + len); g.connect(o); return g; };
  tone(swell(0.32, 4, 6), 'sine', 58, 46, t, len, 1, 0.01);                       // дрожащий подземный гул
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.connect(swell(0.14, 4.5, 6.5));
  tone(lp, 'sawtooth', 82, 74, t, len, 1, 0.01);
  noiseHit(swell(0.5, 3.5, 6), 'lowpass', 800, 180, 0.6, t, len, 1, 0.01);                   // туман ложится
  for (const f of [392, 415]) tone(swell(0.03, 5, 6.5), 'sine', f, f * 0.97, t, len, 1, 0.01);  // холодная секунда, едва слышная
  modal(o, t + 1.2, [[98, 0.7, 3.4], [196, 1, 3], [233, 0.4, 2.2], [466, 0.15, 1.2]], 0.2, 0.004);
  modal(o, t + 4.4, [[98, 0.7, 3.4], [196, 1, 3], [233, 0.4, 2.2], [466, 0.15, 1.2]], 0.14, 0.004);
  audioDuck(0.4, 5.5);
}

// ---------- Расписание редких звуков ----------
const Amb2 = { bird: 4, owl: 20, scary: 50, bat: 25, last: 0, lastScary: '', fogNi: null, cuckooAt: 0 };
const ambRnd = (a, b) => a + Math.random() * (b - a);

// Случайная точка в видимой части мира: далёкие звуки сами станут глуше и тише
function ambPoint() {
  const s = camScale(), W = R.canvas.clientWidth, H = R.canvas.clientHeight;
  return [R.cam.x + ambRnd(0.08, 0.92) * W / s, R.cam.y + ambRnd(0.08, 0.92) * H / s];
}
function ambPick(list) { const tot = list.reduce((a, p) => a + p[1], 0); let r = Math.random() * tot; for (const [k, w] of list) { r -= w; if (r <= 0) return k; } return list[0][0]; }

function ambienceTick() {
  if (!Sfx.ctx || !Sfx.on || Game.paused || Sfx.ctx.state !== 'running' || !R.canvas) return;
  const now = performance.now() / 1000, dt = Math.min(1, now - (Amb2.last || now)); Amb2.last = now;
  if (dt <= 0) return;
  const night = nightAmt(), fog = fogAmt(), rain = typeof WX !== 'undefined' ? WX.k || 0 : 0;

  // туман опускается: один раз за ночь, когда он начинает густеть
  if (Amb2.fogNi === null) Amb2.fogNi = fog > 0.3 ? nightIndex() : -1;                          // загрузились посреди ночи — не пугаем
  if (fog > 0.05 && Amb2.fogNi !== nightIndex()) { Amb2.fogNi = nightIndex(); sfxFogDescend(); Amb2.scary = 0; Amb2.scaryHold = now + 40; }

  // птицы днём: реже в дождь, чаще в первые минуты после рассвета
  if (night < 0.12 && rain < 0.5) {
    Amb2.bird -= dt;
    if (Amb2.bird <= 0) {
      const dawn = typeof Music !== 'undefined' && now < Music.dawnUntil;
      Amb2.bird = dawn ? ambRnd(2.5, 6) : ambRnd(8, 22) * (1 + rain);
      const kinds = [['tweet', 4], ['trill', 2], ['warble', 3], ['coo', 1.5]];
      if (now > Amb2.cuckooAt) kinds.push(['cuckoo', 1]);
      const k = ambPick(kinds); if (k === 'cuckoo') Amb2.cuckooAt = now + 90;
      const [x, y] = ambPoint(); sfxAt(k, x, y, 0.8 + Math.random() * 0.4);
    }
  }

  // совы ночью: уханье и ответ издалека
  if (night > 0.6) {
    Amb2.owl -= dt;
    if (Amb2.owl <= 0) {
      Amb2.owl = ambRnd(18, 50);
      const [x, y] = ambPoint(); sfxAt('hoot', x, y, 0.8);
      if (Math.random() < 0.55) { const [x2, y2] = ambPoint(); sfxAt('hootFar', x2, y2, 0.7, ambRnd(2, 3.5)); }
    }
  }

  // жуть: только в густом тумане, раз в минуту-две, одно и то же подряд не бывает
  if (night > 0.7 && fog > 0.4 && now > (Amb2.scaryHold || 0)) {
    Amb2.scary -= dt;
    if (Amb2.scary <= 0) {
      Amb2.scary = ambRnd(45, 120);
      const k = ambPick([['howl', 3], ['bell', 2], ['whisper', 2], ['gust', 2]].filter(p => p[0] !== Amb2.lastScary));
      Amb2.lastScary = k;
      const [x, y] = ambPoint(); sfxAt(k, x, y, 1);
    }
  }

  // редкий писк летучей мыши, если они над деревней
  if (night > 0.5 && Game.bats && Game.bats.length) {
    Amb2.bat -= dt;
    if (Amb2.bat <= 0) { Amb2.bat = ambRnd(25, 70); const b = Game.bats[(Math.random() * Game.bats.length) | 0]; sfxAt('squeak', b.x * TILE, b.y * TILE, 0.55); }
  }
}

{
  const _tick = sfxTick;
  sfxTick = function (dt) { _tick(dt); ambienceTick(); };
}
