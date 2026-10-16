'use strict';
// Музыка: три собственных трека, синтез через WebAudio, без файлов. Треки сменяют друг друга.
//  1) «Чаща»   — лесная, таинственная: ре дорийский, 3/4. Низкая флейта, арфа,
//                виолончельный бурдон, мягкий бойран «сердцебиением», колокольчики;
//                во второй половине — протяжные женские распевы.
//  2) «Долина» — светлый вальс в соль мажоре: флейта поёт напев, скрипка ведёт подголосок,
//                арфа и цимбалы перебирают, контрабас щиплет, бубен.
//  3) «Ярмарка» — живая джига 6/8 в ре мажоре: скрипка с форшлагами, свирель вторит
//                октавой выше, цимбалы на слабых долях, бойран и шейкер.
// Мелодии строятся из мотивов: короткие обороты повторяются и отвечают друг другу.

const Music = {
  ctx: null, master: null, bus: null, rev: null, hall: null, on: true, started: false,
  bar: 0, nextTime: 0, timer: null, buffers: new Map(), track: 0, songs: [],
};

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
function musicRng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- Треки ----------
// eighth — длительность восьмой (такт всегда 6 восьмых: 3/4 или 6/8)

const TRACKS = [
  {
    name: 'Чаща', eighth: 0.31, swing: 0, bars: 32, voiceFrom: 16, seed: 71, lead: 'lowflute',
    scale: [50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77],
    chords: {
      Dm: { root: 38, tones: [50, 53, 57, 62, 65, 69, 74] }, C: { root: 36, tones: [48, 52, 55, 60, 64, 67, 72] },
      Am: { root: 45, tones: [52, 57, 60, 64, 69, 72, 76] }, G: { root: 43, tones: [50, 55, 59, 62, 67, 71, 74] },
      F: { root: 41, tones: [48, 53, 57, 60, 65, 69, 72] },
    },
    prog: ['Dm', 'Dm', 'C', 'Am', 'Dm', 'G', 'Am', 'Dm', 'F', 'C', 'Dm', 'Am', 'G', 'C', 'Am', 'Dm'],
    rhythms: [[4, 2], [3, 3], [2, 2, 2], [2, 4], [3, 1, 2], [6]],
    range: [57, 74],
  },
  {
    name: 'Долина', eighth: 0.22, swing: 0, bars: 48, voiceFrom: 32, seed: 233, lead: 'flute',
    scale: [55, 57, 59, 60, 62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81, 83],
    chords: {
      G: { root: 43, tones: [55, 59, 62, 67, 71, 74, 79] }, D: { root: 38, tones: [54, 57, 62, 66, 69, 74, 78] },
      Em: { root: 40, tones: [55, 59, 64, 67, 71, 76, 79] }, C: { root: 36, tones: [55, 60, 64, 67, 72, 76, 79] },
      Am: { root: 45, tones: [57, 60, 64, 69, 72, 76] },
    },
    prog: ['G', 'D', 'Em', 'C', 'G', 'C', 'D', 'G', 'Em', 'C', 'G', 'D', 'C', 'D', 'G', 'G'],
    rhythms: [[2, 1, 1, 2], [3, 1, 2], [2, 2, 2], [4, 2], [1, 1, 2, 2], [2, 4]],
    range: [67, 83],
  },
  {
    name: 'Ярмарка', eighth: 0.165, swing: 0.012, bars: 48, voiceFrom: 999, seed: 517, lead: 'fiddle',
    scale: [62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86],
    chords: {
      D: { root: 38, tones: [62, 66, 69, 74, 78, 81, 86] }, G: { root: 43, tones: [62, 67, 71, 74, 79, 83, 86] },
      A: { root: 45, tones: [64, 69, 73, 76, 81, 85] }, Bm: { root: 47, tones: [62, 66, 71, 74, 78, 83, 86] },
      Em: { root: 40, tones: [64, 67, 71, 76, 79, 83] },
    },
    prog: ['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D', 'Bm', 'G', 'D', 'A', 'Bm', 'Em', 'A', 'D'],
    rhythms: [[1, 1, 1, 1, 1, 1], [2, 1, 2, 1], [3, 1, 1, 1], [1, 1, 1, 3], [2, 1, 1, 1, 1], [3, 3]],
    range: [66, 86],
  },
];

// ---------- Сочинение ----------
// Мотив — ритм такта и шаги по ладу от опорного звука аккорда. План из 16 тактов:
// A A' A B | A A' B' каданс | C B C A' | A A' B' каданс — повторы делают мелодию запоминающейся.

function composeTrack(tr, seed) {
  const r = musicRng(seed);
  const stepSet = [1, -1, 1, 2, -1, -2, 1, 0, 3, -1];
  const motif = () => {
    const rh = tr.rhythms[(r() * tr.rhythms.length) | 0];
    return { rh, steps: rh.map((_, k) => k === 0 ? 0 : stepSet[(r() * stepSet.length) | 0]) };
  };
  const A = motif(), A2 = { rh: A.rh, steps: A.steps.map((s, k) => k === A.steps.length - 1 ? -s || 1 : s) };
  const B = motif(), B2 = { rh: B.rh, steps: B.steps.map(s => -s) }, C = motif();
  const plan = [A, A2, A, B, A, A2, B2, null, C, B, C, A2, A, A2, B2, null];
  const [lo, hi] = tr.range;
  let prev = Math.round((lo + hi) / 2);
  return tr.prog.map((name, bi) => {
    const tones = tr.chords[name].tones.filter(m => m >= lo && m <= hi);
    const nearest = (to) => tones.reduce((a, t) => Math.abs(t - to) < Math.abs(a - to) ? t : a, tones[0]);
    const m = plan[bi % plan.length];
    if (!m) {
      // каданс: опора на тонику аккорда, долгая нота
      const end = nearest(prev);
      prev = end;
      return [[end, 4], [nearest(end - 2), 2]];
    }
    const anchor = nearest(prev);
    let si = tr.scale.indexOf(anchor); if (si < 0) si = tr.scale.findIndex(x => x >= anchor);
    const notes = [];
    m.rh.forEach((len, k) => {
      si = Math.max(0, Math.min(tr.scale.length - 1, si + m.steps[k]));
      let p = tr.scale[si];
      if (p > hi) p -= 12; if (p < lo) p += 12;
      // долгие ноты — на звуки аккорда, чтобы звучало слаженно
      if (len >= 3) p = nearest(p);
      notes.push([p, len]);
      prev = p;
    });
    return notes;
  });
}

// Подголосок: по одному долгому звуку на такт, плавно, терцией ниже мелодии
function counterLine(tr, song) {
  let prev = tr.range[0] - 4;
  return tr.prog.map((name, bi) => {
    const tones = tr.chords[name].tones.filter(m => m >= tr.range[0] - 10 && m <= tr.range[1] - 5);
    const top = song[bi][0][0] - 3;
    const best = tones.reduce((a, t) => Math.abs(t - prev) + Math.abs(t - top) * 0.5 < Math.abs(a - prev) + Math.abs(a - top) * 0.5 ? t : a, tones[0]);
    prev = best;
    return best;
  });
}

// ---------- Звук ----------

function makeImpulse(ctx, sec, decay = 2.6) {
  const len = ctx.sampleRate * sec, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function out(node, dry = 1, rev = 0, hall = 0) {
  const ctx = Music.ctx;
  if (dry) { const g = ctx.createGain(); g.gain.value = dry; node.connect(g); g.connect(Music.bus); }
  if (rev) { const g = ctx.createGain(); g.gain.value = rev; node.connect(g); g.connect(Music.rev); }
  if (hall) { const g = ctx.createGain(); g.gain.value = hall; node.connect(g); g.connect(Music.hall); }
}

// Щипковая струна (Карплус — Стронг): harp — долгая мягкая, dulc — звонкая с металлом, bass — глухая
function pluckBuffer(hz, kind) {
  const key = Math.round(hz * 10) + kind;
  if (Music.buffers.has(key)) return Music.buffers.get(key);
  const ctx = Music.ctx, sr = ctx.sampleRate, len = sr * (kind === 'bass' ? 1.4 : 3);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / hz)), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = kind === 'bass' ? Math.sin(i / N * Math.PI * 2) * 0.8 + (Math.random() - 0.5) * 0.3 : Math.random() * 2 - 1;
  const k = kind === 'harp' ? 0.4994 : kind === 'dulc' ? 0.4996 : 0.4985;
  let p = 0;
  for (let i = 0; i < len; i++) {
    const nxt = (p + 1) % N;
    const v = kind === 'dulc' ? ring[p] * 0.55 + ring[nxt] * 0.4492 : (ring[p] + ring[nxt]) * k;
    d[i] = ring[p]; ring[p] = v; p = nxt;
  }
  Music.buffers.set(key, buf);
  return buf;
}

function pluckNote(midi, t, vel, kind, cutoff, len) {
  const ctx = Music.ctx, src = ctx.createBufferSource();
  src.buffer = pluckBuffer(midiHz(midi), kind);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
  src.connect(f); f.connect(g);
  src.start(t); src.stop(t + len + 0.05);
  return g;
}

const harp = (m, t, v = 0.35) => out(pluckNote(m, t, v, 'harp', 3000, 2.8), 1, 0.35);
const bassPluck = (m, t, v = 0.5) => out(pluckNote(m, t, v, 'bass', 700, 1.2), 1, 0.08);
// цимбалы: две слегка расстроенные струны — тот самый звонкий «дребезг»
function dulcimer(m, t, v = 0.22) {
  out(pluckNote(m, t, v, 'dulc', 5200, 2.2), 1, 0.3);
  const s2 = pluckNote(m + 0.08, t + 0.004, v * 0.6, 'dulc', 5200, 2);
  out(s2, 1, 0.2);
}

// Флейта: low — глубокая, тёмная, с «воздухом»; whistle — свирель, высокая и звонкая
function flute(midi, t, dur, vel, kind = 'flute') {
  const ctx = Music.ctx, hz = midiHz(midi), low = kind === 'lowflute', wh = kind === 'whistle';
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'sine'; o2.type = 'triangle';
  o1.frequency.value = hz; o2.frequency.value = hz * 2;
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = low ? 4.4 : 5.6;
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * (low ? 0.008 : 0.005), t + Math.min(0.45, dur * 0.6));
  lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
  const g = ctx.createGain(), g2 = ctx.createGain();
  g2.gain.value = low ? 0.06 : wh ? 0.2 : 0.12;
  const att = low ? 0.1 : 0.03;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + att);
  g.gain.setValueAtTime(vel * 0.85, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + (low ? 0.25 : 0.07));
  const nb = ctx.createBufferSource(), nbf = ctx.createBiquadFilter(), ng = ctx.createGain();
  nb.buffer = Music.noise; nb.loop = true;
  nbf.type = 'bandpass'; nbf.frequency.value = hz * (low ? 1.5 : 2); nbf.Q.value = low ? 2.2 : 1.4;
  ng.gain.setValueAtTime(vel * (low ? 0.6 : 0.4), t);
  if (low) { ng.gain.exponentialRampToValueAtTime(vel * 0.18, t + 0.2); ng.gain.setValueAtTime(vel * 0.18, t + dur); }
  ng.gain.exponentialRampToValueAtTime(0.0001, t + (low ? dur + 0.25 : 0.08));
  nb.connect(nbf); nbf.connect(ng); out(ng, 1, 0, low ? 0.6 : 0.2);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = low ? 1800 : wh ? 6000 : 4000;
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp);
  out(lp, 1, low ? 0 : 0.3, low ? 0.6 : 0.15);
  const end = t + dur + 0.3;
  for (const n of [o1, o2, lfo]) { n.start(t); n.stop(end); }
  nb.start(t, Math.random()); nb.stop(end);
}

// Скрипка: две пилы с отстройкой, «корпус» резонансами, смычок шумом в атаке, позднее вибрато
function fiddle(midi, t, dur, vel = 0.1, grace = false) {
  const ctx = Music.ctx, hz = midiHz(midi);
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'sawtooth';
  o1.frequency.value = hz; o2.frequency.value = hz; o2.detune.value = 7;
  if (grace) {
    // форшлаг: начинаем на ступень выше и быстро съезжаем на ноту
    o1.frequency.setValueAtTime(hz * 1.122, t); o1.frequency.exponentialRampToValueAtTime(hz, t + 0.05);
    o2.frequency.setValueAtTime(hz * 1.122, t); o2.frequency.exponentialRampToValueAtTime(hz, t + 0.05);
  }
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 5.9;
  lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + Math.min(0.18, dur * 0.4)); lg.gain.linearRampToValueAtTime(hz * 0.007, t + Math.min(0.4, dur));
  lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
  const mix = ctx.createGain(); mix.gain.value = 0.5; o1.connect(mix); o2.connect(mix);
  const body1 = ctx.createBiquadFilter(); body1.type = 'peaking'; body1.frequency.value = 520; body1.Q.value = 2; body1.gain.value = 6;
  const body2 = ctx.createBiquadFilter(); body2.type = 'peaking'; body2.frequency.value = 2900; body2.Q.value = 1.5; body2.gain.value = 5;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vel, t + 0.04);
  env.gain.setValueAtTime(vel * 0.9, t + dur * 0.8);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  mix.connect(body1); body1.connect(body2); body2.connect(lp); lp.connect(env);
  out(env, 1, 0.35, 0.1);
  const nb = ctx.createBufferSource(), nbf = ctx.createBiquadFilter(), ng = ctx.createGain();
  nb.buffer = Music.noise; nbf.type = 'bandpass'; nbf.frequency.value = 3000; nbf.Q.value = 0.8;
  ng.gain.setValueAtTime(vel * 0.25, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  nb.connect(nbf); nbf.connect(ng); out(ng);
  const end = t + dur + 0.15;
  for (const n of [o1, o2, lfo]) { n.start(t); n.stop(end); }
  nb.start(t, Math.random()); nb.stop(t + 0.08);
}

// Виолончель / струнный бурдон: мягкая пила, тёмный фильтр, медленная атака
function cello(midis, t, dur, vel = 0.045) {
  const ctx = Music.ctx, env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vel, t + Math.min(1.2, dur * 0.35));
  env.gain.setValueAtTime(vel, t + dur * 0.75);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 750; lp.Q.value = 0.5;
  lp.connect(env); out(env, 1, 0, 0.5);
  for (const m of midis) for (const det of [-5, 5]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.value = midiHz(m); o.detune.value = det;
    o.connect(lp); o.start(t); o.stop(t + dur + 0.7);
  }
}

// Колокольчик: чистый тон с «стеклянным» обертоном, быстрый спад
function glock(midi, t, vel = 0.08) {
  const ctx = Music.ctx, hz = midiHz(midi);
  for (const [mul, v, len] of [[1, 1, 1.4], [2.76, 0.35, 0.5], [5.4, 0.12, 0.25]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz * mul;
    g.gain.setValueAtTime(vel * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); out(g, 1, 0.5, 0.3);
    o.start(t); o.stop(t + len + 0.05);
  }
}

// Женский голос: две пилы через форманты гласной, вибрато, долгий отзвук
const VOWELS = { a: [[800, 1, 7], [1150, 0.5, 9], [2900, 0.22, 12]], u: [[350, 1, 6], [650, 0.35, 8], [2700, 0.08, 10]] };
function voice(midi, t, dur, vel = 0.07, vowel = 'a') {
  const ctx = Music.ctx, hz = midiHz(midi);
  const o = ctx.createOscillator(), o2 = ctx.createOscillator();
  o.type = 'sawtooth'; o2.type = 'sawtooth';
  o.frequency.value = hz; o2.frequency.value = hz * 1.004;
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 5.1;
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * 0.013, t + Math.min(0.9, dur * 0.5));
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  const mix = ctx.createGain(); mix.gain.value = 0.5; o.connect(mix); o2.connect(mix);
  const sum = ctx.createGain();
  for (const [f, gain, q] of VOWELS[vowel]) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const fg = ctx.createGain(); fg.gain.value = gain * 3;
    mix.connect(bp); bp.connect(fg); fg.connect(sum);
  }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vel, t + Math.min(0.7, dur * 0.4));
  env.gain.setValueAtTime(vel * 0.9, t + dur * 0.75);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600;
  sum.connect(lp); lp.connect(env); out(env, 1, 0, 0.9);
  const end = t + dur + 0.9;
  for (const n of [o, o2, lfo]) { n.start(t); n.stop(end); }
}

// Бойран: тёплый удар кожи с «пальцем» сверху
function bodhran(t, vel, pitch = 95) {
  const ctx = Music.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(pitch * 1.6, t); o.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.16);
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g); out(g, 1, 0.15);
  o.start(t); o.stop(t + 0.32);
  const nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
  nb.buffer = Music.noise; f.type = 'lowpass'; f.frequency.value = 1100;
  ng.gain.setValueAtTime(vel * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  nb.connect(f); f.connect(ng); out(ng);
  nb.start(t, Math.random()); nb.stop(t + 0.06);
}

function shaker(t, vel) {
  const ctx = Music.ctx, nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Music.noise; f.type = 'bandpass'; f.frequency.value = 7000; f.Q.value = 1.2;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  nb.connect(f); f.connect(g); out(g);
  nb.start(t, Math.random()); nb.stop(t + 0.08);
}

function tambourine(t, vel) {
  const ctx = Music.ctx, nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Music.noise; f.type = 'highpass'; f.frequency.value = 6500;
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  nb.connect(f); f.connect(g); out(g, 1, 0.1);
  nb.start(t, Math.random()); nb.stop(t + 0.15);
}

// ---------- Такт ----------

function scheduleBar(tr, song, bar, t) {
  const E = tr.eighth, bi = bar % tr.prog.length, ch = tr.chords[tr.prog[bi]];
  const len = E * 6, at = k => t + k * E + (k % 2 ? tr.swing : 0);
  const up = ch.tones.filter(m => m >= 50 && m < 74);
  const notes = song.mel[bi], counter = song.cnt[bi];
  const voiceNow = bar >= tr.voiceFrom;
  const phraseEnd = bi % 8 === 7;

  if (tr.name === 'Чаща') {
    if (bar % 4 === 0) cello([38, 45], t, len * 4, 0.04);                        // бурдон ре+ля
    [up[0], up[1], up[2], up[3] || up[1] + 12, up[2], up[1]].forEach((m, k) => harp(m, at(k), k === 0 ? 0.3 : 0.18));
    if (bar % 2 === 0) bassPluck(ch.root, t, 0.32);
    bodhran(t, 0.16, 80); if (bar % 2) bodhran(at(3), 0.1, 80);                 // мягкое «сердцебиение»
    for (let k = 1; k < 6; k += 2) shaker(at(k), 0.012);
    if (phraseEnd) [0, 2, 4].forEach((k, j) => glock(ch.tones[ch.tones.length - 1 - j], at(k), 0.06));
    // флейта, а когда поёт голос — только во второй половине фразы
    if (!(voiceNow && bar % 8 < 5)) { let pos = 0; for (const [m, l] of notes) { flute(m, at(pos), l * E * 0.95, pos === 0 ? 0.18 : 0.14, 'lowflute'); pos += l; } }
    if (voiceNow && bar % 2 === 0) {
      const vt = ch.tones.filter(m => m >= 67 && m <= 77);
      const vm = vt[(bar / 2) % vt.length] || vt[0];
      if (vm) { voice(vm, t, len * 2 - E, 0.07, 'a'); if (bar % 4 === 0) voice(vm - (vt.includes(vm - 3) ? 3 : 4), at(2), len * 2 - E * 2, 0.045, 'a'); }
    }
  } else if (tr.name === 'Долина') {
    bassPluck(ch.root, t, 0.48); bassPluck(ch.root + 7, at(4), 0.3);
    harp(up[0] + 12, at(2), 0.18); harp(up[1] + 12, at(4), 0.16);
    // цимбалы тремоло на втором-третьем счёте в каждом втором такте
    if (bar % 2) for (let k = 2; k < 6; k++) dulcimer(up[2] + 12, at(k), 0.08);
    else dulcimer(up[1] + 12, at(3), 0.12);
    bodhran(t, 0.12, 110); tambourine(at(2), 0.03); tambourine(at(4), 0.03);
    let pos = 0;
    for (const [m, l] of notes) { flute(m, at(pos), l * E * 0.95, pos === 0 ? 0.17 : 0.13); pos += l; }
    if (bar >= 8) fiddle(counter, t, len * 0.98, 0.05);                          // скрипка-подголосок
    if (phraseEnd) glock(ch.tones[ch.tones.length - 1], at(4), 0.05);
    if (voiceNow && bar % 2 === 0) { const vt = ch.tones.filter(m => m >= 67 && m <= 76); if (vt[0]) voice(vt[(bar / 2) % vt.length], at(1), len * 2 - E, 0.04, 'u'); }
  } else {
    // «Ярмарка»: бас на раз и четыре, цимбалы на слабых, бойран джигой, шейкер на каждую восьмую
    bassPluck(ch.root, t, 0.5); bassPluck(ch.root + 7, at(3), 0.38);
    dulcimer(up[1] + 12, at(1), 0.1); dulcimer(up[2] + 12, at(2), 0.08); dulcimer(up[1] + 12, at(4), 0.1); dulcimer(up[2] + 12, at(5), 0.08);
    bodhran(t, 0.22, 100); bodhran(at(2), 0.08, 140); bodhran(at(3), 0.16, 100); bodhran(at(5), 0.08, 140);
    for (let k = 0; k < 6; k++) shaker(at(k), k % 3 === 0 ? 0.03 : 0.016);
    let pos = 0;
    for (const [m, l] of notes) {
      fiddle(m, at(pos), l * E * 0.92, pos === 0 || pos === 3 ? 0.11 : 0.085, l >= 2 && pos % 3 === 0);
      // со второго прохода свирель вторит октавой выше
      if (bar >= 16) flute(m + 12, at(pos), l * E * 0.9, 0.07, 'whistle');
      pos += l;
    }
    if (bar >= 32 && bar % 2 === 0) harp(counter, t, 0.22);
    if (phraseEnd) glock(ch.tones[ch.tones.length - 1], at(3), 0.06);
  }
}

function musicTick() {
  if (!Music.on) return;
  const ctx = Music.ctx;
  while (Music.nextTime < ctx.currentTime + 0.5) {
    const tr = TRACKS[Music.track];
    if (Music.bar >= tr.bars) {
      // смена трека с паузой в такт; новые вариации мелодий
      Music.nextTime += tr.eighth * 6;
      Music.track = (Music.track + 1) % TRACKS.length;
      Music.bar = 0;
      const nt = TRACKS[Music.track];
      Music.songs[Music.track] = makeSong(nt, nt.seed + Math.floor(Math.random() * 1000));
      continue;
    }
    if (Music.bar % 16 === 0 && Music.bar > 0) Music.songs[Music.track] = makeSong(tr, tr.seed + Music.bar * 7);
    scheduleBar(tr, Music.songs[Music.track], Music.bar, Music.nextTime);
    Music.nextTime += tr.eighth * 6;
    Music.bar++;
  }
}

function makeSong(tr, seed) {
  const mel = composeTrack(tr, seed);
  return { mel, cnt: counterLine(tr, mel) };
}

function buildMixer(ctx) {
  Music.master = ctx.createGain(); Music.master.gain.value = 0.5;
  // мягкий компрессор склеивает инструменты и не даёт пикам резать уши
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  Music.bus = ctx.createGain(); Music.bus.gain.value = 0.62;
  Music.bus.connect(comp); comp.connect(Music.master);
  Music.rev = ctx.createConvolver(); Music.rev.buffer = makeImpulse(ctx, 2.2);
  const rg = ctx.createGain(); rg.gain.value = 0.25; Music.rev.connect(rg); rg.connect(comp);
  Music.hall = ctx.createConvolver(); Music.hall.buffer = makeImpulse(ctx, 4.5, 2);
  const hg = ctx.createGain(); hg.gain.value = 0.35; Music.hall.connect(hg); hg.connect(comp);
  const nl = ctx.sampleRate * 2;
  Music.noise = ctx.createBuffer(1, nl, ctx.sampleRate);
  const nd = Music.noise.getChannelData(0);
  for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
}

function startMusic() {
  if (Music.started) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  Music.started = true;
  const ctx = Music.ctx = new AC();
  buildMixer(ctx);
  Music.master.connect(ctx.destination);
  Music.songs = TRACKS.map(tr => makeSong(tr, tr.seed));
  Music.track = 0; Music.bar = 0;
  Music.nextTime = ctx.currentTime + 0.15;
  Music.timer = setInterval(musicTick, 80);
  if (!Music.on) ctx.suspend();
}

// Следующий трек: короткое затухание того, что уже запланировано, и сразу новая песня
function nextTrack() {
  startMusic();
  if (!Music.ctx) return;
  if (!Music.on) { setMusic(true); syncMusicBtn(); }
  const ctx = Music.ctx, t = ctx.currentTime, g = Music.bus.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0.0001, t + 0.3);
  g.setValueAtTime(0.0001, t + 0.55); g.linearRampToValueAtTime(0.62, t + 0.75);
  Music.track = (Music.track + 1) % TRACKS.length;
  Music.bar = 0;
  const tr = TRACKS[Music.track];
  Music.songs[Music.track] = makeSong(tr, tr.seed + Math.floor(Math.random() * 1000));
  Music.nextTime = t + 0.6;
  toast(`Музыка: «${tr.name}»`);
}

let syncMusicBtn = () => {};

function setMusic(on) {
  Music.on = on;
  try { localStorage.setItem('feod.music', on ? '1' : '0'); } catch (e) { /* нет доступа к хранилищу */ }
  if (!Music.ctx) return;
  if (on) { Music.ctx.resume(); Music.nextTime = Math.max(Music.nextTime, Music.ctx.currentTime + 0.1); }
  else Music.ctx.suspend();
}

function initMusic() {
  try { Music.on = localStorage.getItem('feod.music') !== '0'; } catch (e) { Music.on = true; }
  const kick = () => { startMusic(); window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
  const btn = document.getElementById('music-btn');
  if (btn) {
    const sync = syncMusicBtn = () => { btn.classList.toggle('active', Music.on); btn.title = Music.on ? 'Музыка: вкл' : 'Музыка: выкл'; };
    btn.onclick = (e) => { e.stopPropagation(); startMusic(); setMusic(!Music.on); sync(); };
    sync();
  }
  const nb = document.getElementById('music-next');
  if (nb) nb.onclick = (e) => { e.stopPropagation(); nextTrack(); };
}
