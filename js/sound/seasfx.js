'use strict';
// Звуки моря (МОРЕ.md) на общем sfx-ядре (sfx.js): приоритеты, полифония, бюджет живности (sfx3.js), место на экране.
//  • прибой — фон: шум с медленным «дыханием» волн; громкость по видимым береговым клеткам моря (ocean.js
//    oceanShoreView), у озёр и рек — тихий плеск; ночью мягче, в шторм гуще и выше, подо льдом молчит;
//  • события: чайка, щелчок клешни, ожог медузы, щебет дельфина, фонтан и песня кита, шип морского змея,
//    рёв кракена и удар щупальца, треск льда зимой; всплеск — общий splash из sfx3.js.

Object.assign(SFX_DEF, {
  gull:       { pri: 1, gain: 0.5,  poly: 2, cd: 0.6,  len: 0.7 },
  crabSnap:   { pri: 1, gain: 0.45, poly: 2, cd: 0.3,  len: 0.12 },
  jellyZap:   { pri: 2, gain: 0.4,  poly: 1, cd: 0.6,  len: 0.3 },
  dolphin:    { pri: 1, gain: 0.4,  poly: 1, cd: 1.2,  len: 0.6 },
  spout:      { pri: 2, gain: 0.55, poly: 1, cd: 2,    len: 1.4, wet: 0.3 },
  whaleSong:  { pri: 2, gain: 0.5,  poly: 1, cd: 6,    len: 3.2, wet: 0.6 },
  serpHiss:   { pri: 2, gain: 0.5,  poly: 1, cd: 0.8,  len: 0.8 },
  krakenRoar: { pri: 4, gain: 0.8,  poly: 1, cd: 1.5,  len: 2.2, wet: 0.4 },
  tentSlam:   { pri: 3, gain: 0.75, poly: 2, cd: 0.25, len: 0.7 },
  iceCrack:   { pri: 0, gain: 0.4,  poly: 1, cd: 2,    len: 0.5, wet: 0.3 },
  oar:        { pri: 0, gain: 0.3,  poly: 2, cd: 0.5,  len: 0.35 },
  reel:       { pri: 0, gain: 0.3,  poly: 1, cd: 1,    len: 0.5 },
});
if (typeof FAUNA_TIER !== 'undefined') Object.assign(FAUNA_TIER, { gull: 1, crabSnap: 1, jellyZap: 1, dolphin: 1, spout: 1, whaleSong: 1, serpHiss: 1, iceCrack: 0, oar: 0, reel: 0 });

Object.assign(SFX, {
  // чайка: «кьяа-кья» — два-три визгливых нисходящих крика с хрипотцой
  gull: (d, t, v) => {
    const r = 0.9 + v * 0.25, n = 2 + (v > 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const tt = t + k * 0.17, f = (1500 - k * 120) * r;
      tone(d, 'sawtooth', f, f * 0.62, tt, 0.13, 0.09, 0.01);
      tone(d, 'triangle', f * 1.5, f * 0.9, tt, 0.12, 0.08, 0.01);
      noiseHit(d, 'bandpass', 2600 * r, 1800, 3, tt, 0.1, 0.05, 0.01);
    }
  },
  // клешня: сухой щелчок панциря
  crabSnap: (d, t, v) => {
    noiseHit(d, 'highpass', 3800, 3000, 1, t, 0.02, 0.4, 0.001);
    tone(d, 'square', 1800 + v * 400, 900, t, 0.025, 0.12, 0.001);
    noiseHit(d, 'highpass', 4200, 3000, 1, t + 0.06, 0.015, 0.25, 0.001);
  },
  // ожог медузы: шипящий треск с дрожью
  jellyZap: (d, t, v) => {
    noiseHit(d, 'bandpass', 5200, 3000, 4, t, 0.22, 0.25, 0.005);
    tone(d, 'square', 90 + v * 30, 60, t, 0.2, 0.05, 0.005);
  },
  // дельфин: щебет-трель вверх
  dolphin: (d, t, v) => {
    for (let k = 0; k < 4; k++) tone(d, 'sine', (2400 + k * 300 + v * 400), 3400 + k * 200, t + k * 0.07, 0.05, 0.12, 0.005);
    tone(d, 'sine', 3000, 4200, t + 0.32, 0.15, 0.1, 0.01);
  },
  // фонтан кита: выдох и шуршащие брызги
  spout: (d, t, v) => {
    breath(d, t, 1.1, 420, 900, 0.35, 0.08);
    noiseHit(d, 'highpass', 3000, 2000, 0.6, t + 0.2, 1.0, 0.18, 0.2);
    noiseHit(d, 'lowpass', 500, 200, 0.8, t, 0.4, 0.3, 0.02);
  },
  // песня кита: медленные глиссандо низким голосом с гулом
  whaleSong: (d, t, v) => {
    const b = 140 + v * 40;
    tone(d, 'sine', b, b * 1.8, t, 1.2, 0.35, 0.4);
    tone(d, 'sine', b * 1.8, b * 1.2, t + 1.1, 1.2, 0.3, 0.3);
    tone(d, 'triangle', b * 0.5, b * 0.45, t, 2.6, 0.12, 0.6);
    tone(d, 'sine', b * 2.7, b * 3.1, t + 0.5, 0.9, 0.06, 0.3);
  },
  // морской змей: длинный шип с тресканием
  serpHiss: (d, t, v) => {
    noiseHit(d, 'highpass', 2600 + v * 800, 4500, 1.2, t, 0.7, 0.4, 0.06);
    tone(d, 'sawtooth', 70, 50, t, 0.5, 0.05, 0.05);
  },
  // кракен: утробный рёв из глубины, пузыри
  krakenRoar: (d, t, v) => {
    const b = 46 + v * 10;
    tone(d, 'sawtooth', b, b * 0.7, t, 1.8, 0.4, 0.25);
    tone(d, 'square', b * 1.5, b * 1.1, t + 0.1, 1.6, 0.12, 0.3);
    noiseHit(d, 'lowpass', 400, 120, 1, t, 1.9, 0.35, 0.3);
    for (let k = 0; k < 5; k++) tone(d, 'sine', 180 + k * 40, 500 + k * 60, t + 0.3 + k * 0.23, 0.07, 0.12, 0.01);
  },
  // удар щупальца: шлепок по мокрому, всплеск, глухой удар в землю
  tentSlam: (d, t, v) => {
    noiseHit(d, 'lowpass', 900, 200, 0.8, t, 0.25, 0.7, 0.003);
    tone(d, 'sine', 90 + v * 20, 40, t, 0.3, 0.6, 0.003);
    noiseHit(d, 'bandpass', 2200, 900, 1.2, t + 0.05, 0.4, 0.3, 0.01);
  },
  // лёд трещит: короткие высокие щелчки с гулким «пиу»
  iceCrack: (d, t, v) => {
    noiseHit(d, 'highpass', 3000, 2500, 1, t, 0.02, 0.35, 0.001);
    tone(d, 'sine', 1800 + v * 600, 300, t + 0.01, 0.35, 0.12, 0.002);
    noiseHit(d, 'highpass', 4000, 2500, 1, t + 0.09, 0.015, 0.2, 0.001);
  },
  // весло: плеск и скрип уключины
  oar: (d, t, v) => {
    noiseHit(d, 'bandpass', 1300, 600, 1, t, 0.18, 0.25, 0.02);
    tone(d, 'triangle', 520 + v * 80, 460, t + 0.1, 0.12, 0.05, 0.02);
  },
  // катушка лески: стрекот
  reel: (d, t) => { for (let k = 0; k < 6; k++) noiseHit(d, 'highpass', 4500, 4000, 2, t + k * 0.05, 0.012, 0.14, 0.001); },
});

// ---------- Прибой: фон по видимому берегу ----------
const SeaAmb = { a: null, t: 0, view: null, gullT: 8, iceT: 5 };
function seaAmbBuild() {
  const ctx = Sfx.ctx, A = SeaAmb.a = {};
  const mkGain = () => { const g = ctx.createGain(); g.gain.value = 0; g.connect(AudioCore.amb); return g; };
  // море: широкий шум, «дыхание» волны 0,12 Гц (накат и откат), отдельный шипящий слой пены
  A.sea = mkGain();
  { const src = ctx.createBufferSource(); src.buffer = Sfx.noise; src.loop = true; src.playbackRate.value = 0.6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.5;
    const swell = ctx.createOscillator(), sg = ctx.createGain(); swell.frequency.value = 0.12; sg.gain.value = 0.45; swell.connect(sg);
    const am = ctx.createGain(); am.gain.value = 0.55; sg.connect(am.gain);
    const lfoF = ctx.createOscillator(), fg = ctx.createGain(); lfoF.frequency.value = 0.12; fg.gain.value = 380; lfoF.connect(fg); fg.connect(lp.frequency);
    src.connect(lp); lp.connect(am); am.connect(A.sea);
    A.seaLp = lp;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
    const fam = ctx.createGain(); fam.gain.value = 0.0; const fs = ctx.createGain(); fs.gain.value = 0.18; swell.connect(fs); fs.connect(fam.gain);
    src.connect(hp); hp.connect(fam); fam.connect(A.sea);
    src.start(); swell.start(); lfoF.start(); }
  // озеро и река: тихий плеск с быстрым «журчанием»
  A.calm = mkGain();
  { const src = ctx.createBufferSource(); src.buffer = Sfx.noise; src.loop = true; src.playbackRate.value = 1;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.9;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.7; lg.gain.value = 0.4; lfo.connect(lg);
    const am = ctx.createGain(); am.gain.value = 0.5; lg.connect(am.gain);
    src.connect(bp); bp.connect(am); am.connect(A.calm); src.start(); lfo.start(); }
  if (A.sea && ctx.createStereoPanner) { /* панорама — общей шиной фона, у прибоя её задаёт положение берега */ }
}
function seaAmbTick(dt) {
  if (!Sfx.ctx || !Sfx.on || typeof oceanShoreView !== 'function') return;
  if (!SeaAmb.a) { AudioCore.keep = true; try { seaAmbBuild(); } finally { AudioCore.keep = false; } }
  const A = SeaAmb.a, t = Sfx.ctx.currentTime;
  SeaAmb.t -= dt;
  if (SeaAmb.t <= 0) { SeaAmb.t = 0.5; SeaAmb.view = oceanShoreView(); }
  const v = SeaAmb.view;
  const ice = typeof SEA === 'function' ? Math.min(1, SEA().ice || 0) : 0;
  const night = typeof nightAmt === 'function' ? nightAmt() : 0;
  const storm = typeof oceanStorm === 'function' ? oceanStorm() : 0;
  const zoom = Math.min(1.1, Math.max(0.5, 0.4 + R.cam.z * 0.25));
  const sea = v ? Math.min(1, v.sea * 9 + v.water * 0.6 * (v.sea > 0 ? 1 : 0)) : 0;
  const calm = v ? Math.min(1, v.calm * 8) : 0;
  const k = (1 - ice) * zoom;
  A.sea.gain.setTargetAtTime(0.13 * sea * k * (1 - 0.3 * night) * (1 + storm * 1.2), t, 1.5);
  A.seaLp.frequency.setTargetAtTime(700 + storm * 900, t, 2);
  A.calm.gain.setTargetAtTime(0.035 * calm * k * (1 - 0.3 * night), t, 1.5);
  // чайки днём, если море на виду; зимой — треск льда
  if (v && sea > 0.15 && night < 0.4 && ice < 0.5 && (SeaAmb.gullT -= dt) <= 0) { SeaAmb.gullT = 9 + Math.random() * 14; sfxAt('gull', v.cx, v.cy, 0.45); }
  if (v && ice > 0.8 && v.water > 0.05 && (SeaAmb.iceT -= dt) <= 0) { SeaAmb.iceT = 12 + Math.random() * 20; sfxAt('iceCrack', v.cx, v.cy, 0.6); }
}
{
  const _amb = sfxAmbTick;
  sfxAmbTick = function (dt) { _amb(dt); seaAmbTick(dt); };
}
