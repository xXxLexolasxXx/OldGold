'use strict';
// Вторая часть музыки: новые инструменты и треки.
//   лесные (в игре): «Хрустальная заводь», «Танец светлячков», «Древо памяти»
//   по настроению: «Гроза», «Дождь», «Праздник», «Победа» (с издёвкой), «Кладбище»
// Подключается после music.js. Треки заносятся в TRACKS, партии тактов — в TRACK_SCHED (их зовёт scheduleBar).

// ---------- Новые инструменты ----------

// Хрустальные чаши: чистые синусы с медленным вдохом и биениями — «поющий» хрусталь
function crystalBowl(midi, t, dur, vel = 0.04) {
  const ctx = Music.ctx, hz = midiHz(midi), env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + Math.min(0.8, dur * 0.4));
  env.gain.setValueAtTime(vel * 0.9, t + dur * 0.65); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
  out(env, 1, 0.5, 0.9);
  for (const [mul, v, det] of [[1, 1, -3], [1, 0.8, 3], [2.003, 0.25, 0], [3.01, 0.1, 5]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz * mul; o.detune.value = det; g.gain.value = v;
    o.connect(g); g.connect(env); o.start(t); o.stop(t + dur + 1);
  }
}

// Ветряные подвески: сыплется горстка звонких нот лада, вниз или вверх
function windChimes(t, vel, pool) {
  const n = 5 + ((Math.random() * 4) | 0), up = Math.random() < 0.5;
  let tt = t;
  for (let k = 0; k < n; k++) {
    const m = pool[up ? k % pool.length : (pool.length - 1 - (k % pool.length))];
    glock(m + 12, tt, vel * (0.6 + Math.random() * 0.5));
    tt += 0.05 + Math.random() * 0.09;
  }
}

// Мандолина: щипок, повторённый тремоло, затухающий
function mandolin(midi, t, dur, vel = 0.1) {
  const n = Math.max(1, Math.min(9, Math.round(dur / 0.065)));
  for (let k = 0; k < n; k++) out(pluckNote(midi, t + k * 0.065, vel * (1 - k * 0.07), 'dulc', 4200, 0.5), 1, 0.25);
}

// Окарина: круглый, чуть дымчатый тон — ниже и теплее свирели
function ocarina(midi, t, dur, vel = 0.1) {
  const ctx = Music.ctx, hz = midiHz(midi), o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain(), env = ctx.createGain();
  o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = hz; o2.frequency.value = hz * 2; g2.gain.value = 0.07;
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * 0.006, t + Math.min(0.5, dur));
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + 0.06); env.gain.setValueAtTime(vel * 0.85, t + dur * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  o.connect(g); o2.connect(g2); g.connect(env); g2.connect(env); env.connect(lp); out(lp, 1, 0.3, 0.5);
  const nb = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
  nb.buffer = Music.noise; nf.type = 'bandpass'; nf.frequency.value = hz * 2; nf.Q.value = 2;
  ng.gain.setValueAtTime(vel * 0.3, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  nb.connect(nf); nf.connect(ng); out(ng); nb.start(t, Math.random()); nb.stop(t + 0.2);
  const end = t + dur + 0.3; for (const n of [o, o2, lfo]) { n.start(t); n.stop(end); }
}

// Колёсная лира: гудящая струна и «дребезжащий» мостик
function hurdy(midi, t, dur, vel = 0.05) {
  const ctx = Music.ctx, hz = midiHz(midi), env = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.8;
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + 0.05); env.gain.setValueAtTime(vel, t + dur * 0.85); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  lp.connect(env); out(env, 1, 0.2, 0.2);
  for (const det of [-4, 4]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.2); }
  const nb = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), bg = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  nb.buffer = Music.noise; nb.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.5;
  bg.gain.value = vel * 0.35; lfo.type = 'square'; lfo.frequency.value = 38; lg.gain.value = vel * 0.35; lfo.connect(lg); lg.connect(bg.gain);
  nb.connect(bp); bp.connect(bg); bg.connect(env);
  nb.start(t, Math.random()); nb.stop(t + dur + 0.2); lfo.start(t); lfo.stop(t + dur + 0.2);
}

// Аккордеон: язычки (две расстроенные прямоугольные), мех «дышит» тремоло
function accordion(midis, t, dur, vel = 0.03) {
  const ctx = Music.ctx, env = ctx.createGain(), lp = ctx.createBiquadFilter(), trem = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.7;
  trem.gain.value = 0.7; lfo.frequency.value = 6.2; lg.gain.value = 0.3; lfo.connect(lg); lg.connect(trem.gain);
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + 0.04); env.gain.setValueAtTime(vel, t + dur * 0.85); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  lp.connect(trem); trem.connect(env); out(env, 1, 0.2, 0.25);
  for (const m of midis) for (const det of [-9, 9]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = midiHz(m); o.detune.value = det; const g = ctx.createGain(); g.gain.value = 0.3; o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 0.15); }
  lfo.start(t); lfo.stop(t + dur + 0.15);
}

// Топот ногами и хлопок в ладоши
function stomp(t, vel = 0.3) {
  bodhran(t, vel, 55);
  const ctx = Music.ctx, nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Music.noise; f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.9;
  g.gain.setValueAtTime(vel * 0.5, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  nb.connect(f); f.connect(g); out(g, 1, 0.15); nb.start(t, Math.random()); nb.stop(t + 0.09);
}

// Звон кружек
function mugClink(t, vel = 0.05) {
  const ctx = Music.ctx, f0 = 2900 + Math.random() * 500;
  for (const [mul, v, len] of [[1, 1, 0.45], [1.52, 0.6, 0.3], [2.1, 0.35, 0.2]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f0 * mul;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * v, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); out(g, 1, 0.3); o.start(t); o.stop(t + len + 0.03);
  }
}

// Казу: нахальный носовой гул с жужжащей мембраной
function kazoo(midi, t, dur, vel = 0.08) {
  const ctx = Music.ctx, hz = midiHz(midi), env = ctx.createGain(), bp = ctx.createBiquadFilter(), bp2 = ctx.createBiquadFilter(), am = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 3.5; bp2.type = 'peaking'; bp2.frequency.value = 2300; bp2.gain.value = 6;
  am.gain.value = 0.6; lfo.type = 'square'; lfo.frequency.value = 85; lg.gain.value = 0.4; lfo.connect(lg); lg.connect(am.gain);
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + 0.03); env.gain.setValueAtTime(vel * 0.9, t + dur * 0.8); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
  bp.connect(bp2); bp2.connect(am); am.connect(env); out(env, 1, 0.15, 0.1);
  const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 6.4; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(hz * 0.012, t + Math.min(0.3, dur)); vib.connect(vg);
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; vg.connect(o.frequency); o.connect(bp);
  const end = t + dur + 0.1; for (const n of [o, vib, lfo]) { n.start(t); n.stop(end); }
}

// Тарелки: шумовой взрыв и звон
function cymbal(t, vel = 0.1) {
  const ctx = Music.ctx, nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Music.noise; nb.loop = true; f.type = 'highpass'; f.frequency.value = 5200;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  nb.connect(f); f.connect(g); out(g, 1, 0.3, 0.4); nb.start(t, Math.random()); nb.stop(t + 1.4);
}

// Свисток-кулиса: скольжение тона (и вверх, и вниз)
function slideWhistle(t, m0, m1, dur, vel = 0.06) {
  const ctx = Music.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(midiHz(m0), t); o.frequency.exponentialRampToValueAtTime(midiHz(m1), t + dur);
  lfo.frequency.value = 7; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.03); g.gain.setValueAtTime(vel, t + dur - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  o.connect(g); out(g, 1, 0.25, 0.2);
  for (const n of [o, lfo]) { n.start(t); n.stop(t + dur + 0.1); }
}

// Тромбон с «вау»: фильтр раскрывается и закрывается; можно съезжать вниз
function wahBrass(midi, t, dur, vel = 0.09, slide = 0) {
  const ctx = Music.ctx, hz = midiHz(midi), env = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 2.5;
  lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(1300, t + dur * 0.35); lp.frequency.exponentialRampToValueAtTime(320, t + dur);
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + 0.05); env.gain.setValueAtTime(vel * 0.9, t + dur * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  lp.connect(env); out(env, 1, 0.2, 0.25);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * 0.015, t + dur); lfo.connect(lg);
  for (const det of [-5, 5]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(hz, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(midiHz(midi - slide), t + dur);
    o.detune.value = det; lg.connect(o.frequency); o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
  }
  lfo.start(t); lfo.stop(t + dur + 0.1);
}

// «Вау-вау-вау-ваааа»: грустный тромбон
function sadTrombone(t, midi, vel = 0.1) {
  wahBrass(midi, t, 0.38, vel); wahBrass(midi - 1, t + 0.45, 0.38, vel); wahBrass(midi - 2, t + 0.9, 0.38, vel);
  wahBrass(midi - 3, t + 1.35, 1.7, vel, 3);
}

// Пфффр: язык меж губ — шум, дрожащий на 30 Гц, плюс низкий «пук»-тон
function raspberry(t, vel = 0.12) {
  const ctx = Music.ctx, nb = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  nb.buffer = Music.noise; nb.loop = true; bp.type = 'bandpass'; bp.frequency.setValueAtTime(700, t); bp.frequency.linearRampToValueAtTime(380, t + 0.6); bp.Q.value = 1.2;
  g.gain.value = 0.5; lfo.type = 'sawtooth'; lfo.frequency.setValueAtTime(34, t); lfo.frequency.linearRampToValueAtTime(18, t + 0.6); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(g.gain);
  const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + 0.03); env.gain.setValueAtTime(vel, t + 0.45); env.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
  nb.connect(bp); bp.connect(g); g.connect(env); out(env, 1, 0.1);
  nb.start(t, Math.random()); nb.stop(t + 0.7); lfo.start(t); lfo.stop(t + 0.7);
  const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.linearRampToValueAtTime(70, t + 0.6);
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(vel * 0.5, t + 0.04); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; o.connect(lp); lp.connect(og); out(og); o.start(t); o.stop(t + 0.65);
}

// Раскат грома: треск и долгое низкое ворчание
function thunderRoll(t, len = 3, vel = 0.2) {
  const ctx = Music.ctx, nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Music.noise; nb.loop = true; f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(90, t + len); f.Q.value = 0.8;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.05);
  for (let k = 1; k < 5; k++) g.gain.linearRampToValueAtTime(vel * (0.35 + Math.random() * 0.5) * (1 - k * 0.15), t + k * len / 5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  nb.connect(f); f.connect(g); out(g, 1, 0.1, 0.9); nb.start(t, Math.random() * 2); nb.stop(t + len + 0.1);
  const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(52, t); o.frequency.exponentialRampToValueAtTime(34, t + len);
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(vel * 0.7, t + 0.2); og.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(og); out(og); o.start(t); o.stop(t + len + 0.1);
}

// Струнное тремоло (сул понтичелло): дрожащий пад
function tremStrings(midis, t, dur, vel = 0.03) {
  const ctx = Music.ctx, env = ctx.createGain(), lp = ctx.createBiquadFilter(), am = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 2200; am.gain.value = 0.6; lfo.frequency.value = 9; lg.gain.value = 0.4; lfo.connect(lg); lg.connect(am.gain);
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + Math.min(0.5, dur * 0.3)); env.gain.setValueAtTime(vel, t + dur * 0.8); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
  lp.connect(am); am.connect(env); out(env, 1, 0.3, 0.6);
  for (const m of midis) for (const det of [-6, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiHz(m); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.5); }
  lfo.start(t); lfo.stop(t + dur + 0.5);
}

// Дождевая пелена
function rainWash(t, len, vel = 0.03) {
  const ctx = Music.ctx, nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Music.noise; nb.loop = true; f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.5;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + len * 0.3); g.gain.setValueAtTime(vel, t + len * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + len);
  nb.connect(f); f.connect(g); out(g, 1, 0.2, 0.3); nb.start(t, Math.random() * 2); nb.stop(t + len + 0.05);
}

// Похоронный колокол: низкий, с негармоничными обертонами и очень долгим спадом
function bellToll(midi, t, vel = 0.1) {
  const ctx = Music.ctx, hz = midiHz(midi);
  for (const [mul, v, len] of [[0.5, 0.7, 5], [1, 1, 4.5], [1.19, 0.6, 3.5], [1.56, 0.45, 2.8], [2, 0.4, 2.2], [2.51, 0.25, 1.6], [3.0, 0.15, 1.2]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz * mul;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); out(g, 1, 0.4, 1); o.start(t); o.stop(t + len + 0.05);
  }
}

// Призрачный голос: «у-у» с плавающей высотой
function ghostGlide(m0, m1, t, dur, vel = 0.05) {
  const ctx = Music.ctx, env = ctx.createGain(), sum = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 4.6; lg.gain.value = 9; lfo.connect(lg);
  for (const det of [-9, 9]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = det;
    o.frequency.setValueAtTime(midiHz(m0), t); o.frequency.exponentialRampToValueAtTime(midiHz(m1), t + dur);
    lg.connect(o.frequency);
    for (const [f, q, gn] of [[330, 6, 1], [700, 8, 0.3]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const gg = ctx.createGain(); gg.gain.value = gn * 1.8; o.connect(bp); bp.connect(gg); gg.connect(sum); }
    o.start(t); o.stop(t + dur + 1);
  }
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + dur * 0.4); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
  sum.connect(env); out(env, 1, 0.3, 1);
  lfo.start(t); lfo.stop(t + dur + 1);
}

// Стук костей: несколько сухих щелчков
function boneClack(t, vel = 0.05) {
  const ctx = Music.ctx, n = 2 + ((Math.random() * 3) | 0);
  for (let k = 0; k < n; k++) {
    const tt = t + k * (0.04 + Math.random() * 0.05), f = 1800 + Math.random() * 1600;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(vel, tt + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03);
    o.connect(g); out(g, 1, 0.35, 0.3); o.start(tt); o.stop(tt + 0.05);
  }
}

// ---------- Треки ----------
TRACKS.push(
  {
    // «Хрустальная заводь» — ре лидийский: чаши и подвески звенят над арфой, окарина тянет напев, женский хор.
    name: 'Хрустальная заводь', fantasy: true, eighth: 0.3, swing: 0, bars: 32, voiceFrom: 8, seed: 3101, lead: 'ocarina', level: 1.0,
    scale: [62, 64, 66, 68, 69, 71, 73, 74, 76, 78, 80, 81, 83, 85, 86],
    chords: {
      D: { root: 38, tones: [50, 54, 57, 62, 66, 69, 74] }, A: { root: 45, tones: [52, 57, 61, 64, 69, 73, 76] },
      Bm: { root: 47, tones: [54, 59, 62, 66, 71, 74, 78] }, E: { root: 40, tones: [52, 56, 59, 64, 68, 71, 76] },
      F: { root: 42, tones: [54, 57, 61, 66, 69, 73, 78] },
    },
    prog: ['D', 'A', 'Bm', 'F', 'D', 'E', 'A', 'D', 'Bm', 'F', 'E', 'A', 'D', 'A', 'E', 'D'],
    rhythms: [[4, 2], [3, 3], [2, 2, 2], [2, 4], [3, 1, 2], [6]],
    range: [64, 85],
  },
  {
    // «Танец светлячков» — ми миксолидийский, быстрый 6/8: мандолина, калимба, свирель, бубен.
    name: 'Танец светлячков', fantasy: true, eighth: 0.2, swing: 0, bars: 48, voiceFrom: 24, seed: 3202, lead: 'whistle', level: 0.9,
    scale: [64, 66, 68, 69, 71, 73, 74, 76, 78, 80, 81, 83, 85, 86, 88],
    chords: {
      E: { root: 40, tones: [52, 56, 59, 64, 68, 71, 76] }, D: { root: 38, tones: [54, 57, 62, 66, 69, 74, 78] },
      A: { root: 45, tones: [57, 61, 64, 69, 73, 76, 81] }, Bm: { root: 47, tones: [54, 59, 62, 66, 71, 74, 78] },
      Cm: { root: 49, tones: [56, 61, 64, 68, 73, 76, 80] },
    },
    prog: ['E', 'D', 'A', 'E', 'E', 'D', 'Bm', 'A', 'Cm', 'D', 'A', 'E', 'E', 'D', 'A', 'E'],
    rhythms: [[2, 1, 1, 2], [1, 1, 1, 1, 1, 1], [3, 1, 2], [2, 2, 2], [1, 1, 2, 2], [3, 3]],
    range: [66, 88],
  },
  {
    // «Древо памяти» — до лидийский, неторопливый: виолончель, хор, мягкий горн, колокола.
    name: 'Древо памяти', fantasy: true, eighth: 0.45, swing: 0, bars: 24, voiceFrom: 4, seed: 3303, lead: 'lowflute', level: 1.15,
    scale: [48, 50, 52, 54, 55, 57, 59, 60, 62, 64, 66, 67, 69, 71, 72, 74, 76],
    chords: {
      C: { root: 36, tones: [48, 52, 55, 60, 64, 67, 72] }, G: { root: 43, tones: [50, 55, 59, 62, 67, 71, 74] },
      Am: { root: 45, tones: [52, 57, 60, 64, 69, 72, 76] }, D: { root: 38, tones: [50, 54, 57, 62, 66, 69, 74] },
      Em: { root: 40, tones: [52, 55, 59, 64, 67, 71, 76] },
    },
    prog: ['C', 'G', 'Am', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'Em', 'C', 'G', 'C', 'D', 'Em', 'C'],
    rhythms: [[6], [4, 2], [3, 3], [2, 4], [6], [3, 3]],
    range: [55, 76],
  },
  {
    // «Гроза» — ре минор, частые удары: барабаны, тремоло струн, горн, скрипка рвёт мотив, гром сам по себе.
    name: 'Гроза', special: 'storm', eighth: 0.22, swing: 0, bars: 32, voiceFrom: 8, seed: 3404, lead: 'fiddle', level: 1.0,
    scale: [50, 52, 53, 55, 57, 58, 60, 62, 64, 65, 67, 69, 70, 72, 74],
    chords: {
      Dm: { root: 38, tones: [50, 53, 57, 62, 65, 69, 74] }, Bb: { root: 46, tones: [53, 58, 62, 65, 70, 74] },
      Gm: { root: 43, tones: [50, 55, 58, 62, 67, 70] }, A: { root: 45, tones: [52, 57, 61, 64, 69, 73] },
      C: { root: 36, tones: [48, 52, 55, 60, 64, 67, 72] },
    },
    prog: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'Bb', 'A', 'Dm', 'C', 'Bb', 'A', 'Gm', 'A', 'Dm', 'Dm'],
    rhythms: [[1, 1, 2, 2], [2, 1, 2, 1], [1, 1, 1, 1, 1, 1], [3, 1, 1, 1], [2, 2, 2], [1, 1, 4]],
    range: [57, 76],
  },
  {
    // «Дождь» — ля минор, тихо: капли калимбы, медленная арфа, виолончель, далёкая флейта.
    name: 'Дождь', special: 'rain', eighth: 0.34, swing: 0, bars: 32, voiceFrom: 999, seed: 3505, lead: 'kalimba', level: 1.1,
    scale: [57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81],
    chords: {
      Am: { root: 45, tones: [57, 60, 64, 69, 72, 76] }, F: { root: 41, tones: [53, 57, 60, 65, 69, 72, 77] },
      C: { root: 36, tones: [55, 60, 64, 67, 72, 76] }, G: { root: 43, tones: [55, 59, 62, 67, 71, 74] },
      Dm: { root: 38, tones: [57, 62, 65, 69, 74, 77] }, E: { root: 40, tones: [56, 59, 64, 68, 71, 76] },
    },
    prog: ['Am', 'F', 'C', 'G', 'Am', 'Dm', 'F', 'E', 'Am', 'F', 'C', 'G', 'Dm', 'F', 'E', 'Am'],
    rhythms: [[3, 3], [2, 4], [4, 2], [2, 2, 2], [6], [3, 1, 2]],
    range: [60, 79],
  },
  {
    // «Праздник» — соль мажор, джига: скрипка, лира, аккордеон, мандолина, топот и звон кружек.
    name: 'Праздник', special: 'feast', eighth: 0.15, swing: 0.01, bars: 48, voiceFrom: 16, seed: 3606, lead: 'fiddle', level: 0.9,
    scale: [55, 57, 59, 60, 62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81, 83],
    chords: {
      G: { root: 43, tones: [55, 59, 62, 67, 71, 74, 79] }, C: { root: 36, tones: [55, 60, 64, 67, 72, 76, 79] },
      D: { root: 38, tones: [54, 57, 62, 66, 69, 74, 78] }, Em: { root: 40, tones: [55, 59, 64, 67, 71, 76, 79] },
      Am: { root: 45, tones: [57, 60, 64, 69, 72, 76] },
    },
    prog: ['G', 'C', 'G', 'D', 'G', 'C', 'D', 'G', 'Em', 'C', 'G', 'D', 'Am', 'C', 'D', 'G'],
    rhythms: [[1, 1, 1, 1, 1, 1], [2, 1, 2, 1], [3, 1, 1, 1], [1, 1, 1, 3], [2, 1, 1, 1, 1], [3, 3]],
    range: [62, 83],
  },
  {
    // «Победа» — до мажор, громко и самодовольно: горны, казу, тарелки, и в конце тромбон «вау-вау» над побеждённым.
    name: 'Победа', special: 'victory', eighth: 0.2, swing: 0, bars: 16, voiceFrom: 2, seed: 3707, lead: 'kazoo', level: 1.0,
    scale: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84],
    chords: {
      C: { root: 36, tones: [48, 52, 55, 60, 64, 67, 72] }, F: { root: 41, tones: [53, 57, 60, 65, 69, 72, 77] },
      G: { root: 43, tones: [55, 59, 62, 67, 71, 74, 79] }, Am: { root: 45, tones: [57, 60, 64, 69, 72, 76] },
      Dm: { root: 38, tones: [50, 53, 57, 62, 65, 69, 74] },
    },
    prog: ['C', 'C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C', 'F', 'G', 'C', 'F', 'G', 'C', 'C'],
    rhythms: [[2, 1, 1, 2], [3, 3], [1, 1, 1, 3], [2, 2, 2], [1, 1, 2, 2], [3, 1, 2]],
    range: [64, 84],
  },
  {
    // «Кладбище» — ля гармонический минор, редкие удары: колокол, хрусталь, призрачные голоса, кости и ветер.
    name: 'Кладбище', special: 'grave', eighth: 0.5, swing: 0, bars: 24, voiceFrom: 4, seed: 3808, lead: 'kalimba', level: 1.35,
    scale: [57, 59, 60, 62, 64, 65, 68, 69, 71, 72, 74, 76, 77, 80, 81],
    chords: {
      Am: { root: 45, tones: [57, 60, 64, 69, 72, 76] }, E: { root: 40, tones: [56, 59, 64, 68, 71, 76] },
      Dm: { root: 38, tones: [57, 62, 65, 69, 74, 77] }, F: { root: 41, tones: [53, 57, 60, 65, 69, 72] },
      B: { root: 47, tones: [59, 62, 65, 71, 74, 77] },
    },
    prog: ['Am', 'Am', 'E', 'Am', 'Dm', 'Am', 'E', 'E', 'F', 'E', 'Am', 'Am', 'B', 'E', 'Am', 'Am'],
    rhythms: [[6], [4, 2], [3, 3], [2, 4], [6], [5, 1]],
    range: [57, 77],
  },
);

// ---------- Партии тактов ----------
// c = { E, len, at(k), up, ch, notes, counter, voiceNow, phraseEnd, bi }
const TRACK_SCHED = {};
const eachNote = (c, fn) => { let pos = 0; for (const [m, l] of c.notes) { fn(m, c.at(pos), l * c.E, pos); pos += l; } };
const chordTop = ch => ch.tones[ch.tones.length - 1];

TRACK_SCHED['Хрустальная заводь'] = (tr, song, bar, t, c) => {
  const { E, len, at, ch, voiceNow, phraseEnd } = c, up = ch.tones.filter(m => m >= 54);
  // чаши тянутся через два такта, подвески изредка проливаются сверху
  if (bar % 2 === 0) { crystalBowl(up[0] + 12, t, len * 2, 0.034); crystalBowl(up[2] + 12, t + 0.1, len * 2 - 0.1, 0.026); }
  if (bar % 4 === 3 || phraseEnd) windChimes(at(1), 0.045, tr.scale.slice(8).map(m => m));
  [0, 1, 2, 3, 2, 1].forEach((i, k) => harp(up[i % up.length] + 12, at(k), k % 3 === 0 ? 0.15 : 0.09));
  bassPluck(ch.root, t, 0.28);
  if (bar % 4 === 0) strPad([ch.tones[0], ch.tones[2], ch.tones[4]], t, len * 4, 0.02);
  eachNote(c, (m, tt, d, pos) => { ocarina(m, tt, d * 0.95, pos === 0 ? 0.13 : 0.1); if (bar >= 8 && bar % 4 === 1) kalimba(m + 12, tt, 0.04); });
  if (voiceNow && bar % 2 === 1) choir([up[1], up[2], up[3] || up[1] + 12].map(m => m + 12), t, len * 2 - E, 0.032, bar % 4 === 1 ? 'i' : 'u');
  if (bar % 2 === 1) glock(chordTop(ch), at(3), 0.04);
};

TRACK_SCHED['Танец светлячков'] = (tr, song, bar, t, c) => {
  const { E, len, at, ch, voiceNow, phraseEnd } = c, up = ch.tones.filter(m => m >= 57);
  // мандолина вьёт узор, калимба подпевает, бубен в такт, свирель вторит со второго круга
  [0, 2, 1, 2, 3, 2].forEach((i, k) => mandolin(up[i % up.length] + 12, at(k), 0.12, k % 3 === 0 ? 0.075 : 0.05));
  bassPluck(ch.root, t, 0.34); if (bar % 2) bassPluck(ch.root + 7, at(3), 0.22);
  tambourine(t, 0.03); tambourine(at(3), 0.02); for (const k of [1, 2, 4, 5]) shaker(at(k), 0.008);
  eachNote(c, (m, tt, d, pos) => {
    flute(m, tt, d * 0.9, pos === 0 ? 0.1 : 0.08, 'whistle');
    kalimba(m - 12, tt, 0.05);
    if (bar >= 16) ocarina(m - 12, tt, d * 0.85, 0.045);
  });
  if (bar % 4 === 0) windChimes(at(4), 0.035, tr.scale.slice(6));
  if (voiceNow && bar % 2 === 0) { const vt = ch.tones.filter(m => m >= 69 && m <= 83); if (vt[0]) voice(vt[(bar >> 1) % vt.length], at(1), len - E, 0.036, 'e'); }
  if (phraseEnd) { glock(chordTop(ch), at(2), 0.05); glock(ch.tones[ch.tones.length - 2], at(3), 0.04); }
};

TRACK_SCHED['Древо памяти'] = (tr, song, bar, t, c) => {
  const { E, len, at, ch, voiceNow, phraseEnd } = c;
  // длинный выдох: виолончель-бурдон, хор «а-о-у», тихий горн на фразах, редкие колокола
  if (bar % 2 === 0) cello([ch.root, ch.root + 7], t, len * 2, 0.04);
  strPad([ch.tones[0], ch.tones[2], ch.tones[4]], t, len, 0.022);
  if (voiceNow) choir([ch.tones[1], ch.tones[3], ch.tones[4]].map(m => m + 12 > 80 ? m : m + 12), t, len - E * 0.5, 0.04, ['a', 'o', 'u', 'o'][bar % 4]);
  harp(ch.tones[2] + 12, t, 0.12); harp(ch.tones[4] + 12, at(2), 0.09); harp(ch.tones[3] + 12, at(4), 0.08);
  if (bar % 8 === 0) mHorn(ch.root + 24, t, len * 2 - E, 0.03);
  if (bar % 4 === 2) bellToll(chordTop(ch) - 12, at(1), 0.025);
  eachNote(c, (m, tt, d, pos) => flute(m, tt, d * 0.95, pos === 0 ? 0.13 : 0.1, bar % 8 < 4 ? 'lowflute' : 'flute'));
  if (bar >= 8 && bar % 2) crystalBowl(ch.tones[3] + 24 > 90 ? ch.tones[3] + 12 : ch.tones[3] + 24, at(1), len - E, 0.022);
  if (phraseEnd) [0, 2, 4].forEach((k, j) => glock(ch.tones[ch.tones.length - 1 - j], at(k), 0.05));
};

TRACK_SCHED['Гроза'] = (tr, song, bar, t, c) => {
  const { E, len, at, ch, voiceNow, phraseEnd } = c;
  // бой в груди: тяжёлые удары на 1 и 4, тремоло струн, горн, скрипка рвёт мотив, ливень и гром
  warDrum(t, 0.4, 56); warDrum(at(3), 0.3, 62); if (bar % 2) warDrum(at(5), 0.16, 70);
  if (bar % 4 === 3) for (let k = 3; k < 6; k++) warDrum(at(k) + E * 0.5, 0.1, 80);
  bassPluck(ch.root, t, 0.5); bassPluck(ch.root + 7, at(2), 0.34); bassPluck(ch.root, at(3), 0.44);
  tremStrings([ch.tones[0], ch.tones[2], ch.tones[4]], t, len, 0.024);
  if (bar % 8 === 0) mHorn(ch.root + 24, t, len * 2 - E, 0.05);
  rainWash(t, len, 0.02);
  if (bar % 5 === 1) thunderRoll(at(Math.random() * 4 | 0), 2.4 + Math.random() * 2, 0.17);
  eachNote(c, (m, tt, d, pos) => { fiddle(m, tt, d * 0.9, pos === 0 ? 0.12 : 0.095, d >= E * 2 && pos % 3 === 0); if (bar >= 8 && bar % 4 >= 2) flute(m + 12, tt, d * 0.85, 0.04, 'whistle'); });
  if (bar % 2) for (let k = 0; k < 6; k += 2) dulcimer(ch.tones[k % ch.tones.length] + 12, at(k), 0.07);
  if (voiceNow && bar % 2 === 0) { const vt = ch.tones.filter(m => m >= 45 && m <= 60); if (vt[0]) voice(vt[(bar >> 1) % vt.length], t, len * 2 - E, 0.055, 'o'); }
  if (phraseEnd) { glock(chordTop(ch), at(4), 0.05); thunderRoll(at(1), 3.4, 0.22); }
};

TRACK_SCHED['Дождь'] = (tr, song, bar, t, c) => {
  const { E, len, at, ch, phraseEnd } = c, up = ch.tones.filter(m => m >= 57);
  // тихо: капли калимбы, медленные арфы, виолончель, пелена дождя и настоящие капли
  rainWash(t, len, 0.014);
  [0, 2, 1, 3].forEach((i, k) => harp(up[i % up.length] + 12, at(k * 1.5), k === 0 ? 0.15 : 0.1));
  bassPluck(ch.root, t, 0.28);
  if (bar % 2 === 0) cello([ch.root, ch.root + 7], t, len * 2, 0.034);
  eachNote(c, (m, tt, d, pos) => { kalimba(m, tt, pos === 0 ? 0.12 : 0.09); if (bar % 4 === 2) kalimba(m + 12, tt + 0.04, 0.04); });
  for (let k = 0; k < 3; k++) if (Math.random() < 0.8) droplet(at(Math.random() * 6), 0.035);
  if (bar >= 8 && bar % 4 === 0) flute(c.notes[0][0], t, len * 1.5, 0.07, 'lowflute');
  if (bar % 8 === 5) crystalBowl(chordTop(ch) - 12, at(1), len * 2, 0.022);
  if (phraseEnd) { glock(chordTop(ch), at(2), 0.045); glock(ch.tones[ch.tones.length - 2], at(3), 0.035); }
  if (bar % 12 === 6) thunderRoll(at(2), 4, 0.06);                                   // далёкий-далёкий гром
};

TRACK_SCHED['Праздник'] = (tr, song, bar, t, c) => {
  const { E, len, at, ch, voiceNow, phraseEnd } = c, up = ch.tones.filter(m => m >= 55 && m < 76);
  // пляска: топот и хлопки, лира гудит бурдон, аккордеон на слабых, мандолина, кружки звенят на фразах
  stomp(t, 0.26); stomp(at(3), 0.2); bodhran(at(2), 0.1, 110); bodhran(at(5), 0.1, 110);
  for (let k = 0; k < 6; k++) shaker(at(k), k % 3 === 0 ? 0.03 : 0.016);
  tambourine(at(1), 0.035); tambourine(at(4), 0.035);
  bassPluck(ch.root, t, 0.5); bassPluck(ch.root + 7, at(3), 0.38);
  if (bar % 2 === 0) hurdy(ch.root + 12, t, len * 2, 0.034);
  accordion([up[0], up[2]], at(1), E, 0.024); accordion([up[1], up[3] || up[1] + 12], at(2), E, 0.024); accordion([up[0], up[2]], at(4), E, 0.024); accordion([up[1], up[3] || up[1] + 12], at(5), E, 0.024);
  eachNote(c, (m, tt, d, pos) => {
    fiddle(m, tt, d * 0.9, pos === 0 || pos === 3 ? 0.11 : 0.085, d >= E * 2 && pos % 3 === 0);
    if (bar >= 16) mandolin(m + 12, tt, Math.min(d, 0.4), 0.05);
    if (bar >= 32) flute(m + 12, tt, d * 0.85, 0.05, 'whistle');
  });
  if (voiceNow && bar % 4 === 0) { const vt = ch.tones.filter(m => m >= 67 && m <= 79); if (vt[0]) { voice(vt[0], at(1), 0.4, 0.05, 'a'); voice(vt[1] || vt[0], at(3), 0.5, 0.05, 'a'); } }
  if (phraseEnd) { mugClink(at(0), 0.05); mugClink(at(1) + 0.03, 0.04); glock(chordTop(ch), at(3), 0.06); }
  if (bar % 8 === 3) mugClink(at(4), 0.035);
};

TRACK_SCHED['Победа'] = (tr, song, bar, t, c) => {
  const { E, len, at, ch, notes } = c;
  const mock = bar >= 12;                       // последние такты — «вау-вау» над побеждённым
  if (!mock) {
    // фанфара: горны октавами, барабаны, тарелки и нахальное казу
    warDrum(t, 0.36, 66); warDrum(at(3), 0.26, 72); for (const k of [1, 2, 4, 5]) bodhran(at(k), 0.06, 130);
    mHorn(ch.root + 24, t, len - E, 0.06); mHorn(ch.root + 31, t, len - E, 0.04);
    bassPluck(ch.root, t, 0.5); bassPluck(ch.root + 7, at(3), 0.36);
    if (bar % 4 === 0) cymbal(t, 0.07);
    if (bar % 2 === 1) slideWhistle(at(4), chordTop(ch) - 5, chordTop(ch) + 7, E * 2, 0.04);
    eachNote(c, (m, tt, d, pos) => { kazoo(m, tt, d * 0.88, pos === 0 ? 0.075 : 0.06); if (bar >= 4) fiddle(m, tt, d * 0.85, 0.05); });
    if (bar >= 2) choir([ch.tones[2], ch.tones[3], ch.tones[4]].map(m => m + 12 > 84 ? m : m + 12), t, len - E * 0.5, 0.035, 'a');
    for (let k = 0; k < 6; k += 2) tambourine(at(k), 0.03);
  } else if (bar === 12) {
    // самое пафосное место — и тут же издёвка
    mHorn(ch.root + 24, t, len * 2 - E, 0.065); cymbal(t, 0.09); warDrum(t, 0.4, 66);
    raspberry(at(3) + E * 3, 0.09);
  } else if (bar === 13) {
    sadTrombone(t, 58, 0.085);                  // вау-вау-вау-вааау (си-бемоль)
  } else if (bar === 14) {
    bassPluck(ch.root, t, 0.4); kazoo(c.ch.tones[3] + 12, at(3), E * 2, 0.05);
    slideWhistle(at(0), 84, 60, E * 4, 0.05);   // кулиса вниз: «вжжжух»
  } else {
    // последний такт: «тадам» и жалкий щелчок тарелки
    warDrum(t, 0.36, 66); mHorn(ch.root + 24, t, E * 2, 0.06); glock(chordTop(ch), at(3), 0.07); mugClink(at(5), 0.03);
  }
};

TRACK_SCHED['Кладбище'] = (tr, song, bar, t, c) => {
  const { E, len, at, ch, voiceNow, phraseEnd } = c;
  // редкий похоронный колокол, низкий бурдон, хрусталь с малыми секундами, плывущие призраки, кости и ветер
  if (bar % 4 === 0) { bellToll(ch.root + 12, t, 0.07); cello([ch.root, ch.root + 7], t, len * 4, 0.04); }
  if (bar % 4 === 2) bellToll(ch.root + 24, at(2), 0.03);
  bodhran(t, 0.13, 62); if (bar % 2) bodhran(at(2), 0.08, 58);
  if (bar % 2 === 0) mWave(t, len * 2, 0.022);
  crystalBowl(ch.tones[2] + 12, at(1), len * 1.5, 0.022); if (bar % 3 === 0) crystalBowl(ch.tones[2] + 13, at(1) + 0.15, len, 0.014);
  const quiet = bar % 4 === 3;
  if (!quiet) eachNote(c, (m, tt, d, pos) => { if (pos === 0) kalimba(m, tt, 0.11); else if (pos % 2 === 0) kalimba(m - 12, tt, 0.06); });
  if (voiceNow && bar % 4 === 1) ghostGlide(ch.tones[3] + 12, ch.tones[3] + 9, at(1), len * 2, 0.05);
  if (voiceNow && bar % 8 === 6) ghostGlide(ch.tones[1] + 12, ch.tones[1] + 24 > 84 ? ch.tones[1] + 12 : ch.tones[1] + 19, at(0), len * 2, 0.035);
  if (Math.random() < 0.35) boneClack(at(Math.random() * 6 | 0), 0.035);
  if (bar % 6 === 5) dulcimer(chordTop(ch), at(3), 0.06);
  if (phraseEnd) { glock(chordTop(ch), at(2), 0.05); glock(chordTop(ch) + 1, at(2) + 0.05, 0.03); }
};

// Победа: замечаем, что в схватке кого-то одолели (рассыпавшийся скелет, павший зверь-нейтрал)
const _seenDead = new WeakSet();
function musicScanKills(now) {
  for (const s of Game.skels || []) if (s.state === 'dead' && !_seenDead.has(s)) { _seenDead.add(s); Music.killT = now; }
  for (const n of Game.neutrals || []) if (n.st === 'die' && !_seenDead.has(n)) { _seenDead.add(n); Music.killT = now; }
}

if (typeof musicIndex === 'function') musicIndex();
