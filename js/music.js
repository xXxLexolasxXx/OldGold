'use strict';
// Музыка: два собственных трека, синтез через WebAudio, без файлов.
//  1) «Чаща» — таинственный лес: ре дорийский, 3/4, низкая флейта с дыханием,
//     арфа, гудящий бурдон, во второй половине — протяжные женские распевы «а-а».
//  2) «Долина» — светлая пасторальная тема в духе лесного города эльфов
//     (настроение, не ноты): соль мажор, вальсовый шаг, арфа, струнные,
//     флейта ведёт напев, мягкий бубен, в конце — тихое «у-у» хора.
// Треки сменяют друг друга. Запускается после первого клика игрока.

const Music = {
  ctx: null, master: null, rev: null, hall: null, on: true, started: false,
  bar: 0, nextTime: 0, timer: null, buffers: new Map(), track: 0, songs: [],
};

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

function musicRng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- Треки ----------
// beat — длительность доли, сек; bars — сколько тактов до смены трека;
// prog — аккорды по тактам; voiceFrom — с какого такта вступает голос.

const TRACKS = [
  {
    name: 'Чаща', beat: 0.72, meter: 3, bars: 32, voiceFrom: 16, seed: 71,
    scale: [50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77],   // ре дорийский
    chords: {
      Dm: { root: 38, tones: [50, 53, 57, 62, 65, 69, 74] },
      C:  { root: 36, tones: [48, 52, 55, 60, 64, 67, 72] },
      Am: { root: 45, tones: [52, 57, 60, 64, 69, 72, 76] },
      G:  { root: 43, tones: [50, 55, 59, 62, 67, 71, 74] },
      F:  { root: 41, tones: [48, 53, 57, 60, 65, 69, 72] },
    },
    prog: ['Dm', 'Dm', 'C', 'Am', 'Dm', 'G', 'Am', 'Dm', 'F', 'C', 'Dm', 'Am', 'G', 'C', 'Am', 'Dm'],
    rhythms: [[6], [4, 2], [3, 3], [2, 4], [2, 2, 2], [5, 1]],
    melody: [57, 74], flute: 'low', drone: true,
  },
  {
    name: 'Долина', beat: 0.5, meter: 3, bars: 48, voiceFrom: 32, seed: 233,
    scale: [55, 57, 59, 60, 62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81, 83],   // соль мажор
    chords: {
      G:  { root: 43, tones: [55, 59, 62, 67, 71, 74, 79] },
      D:  { root: 38, tones: [54, 57, 62, 66, 69, 74, 78] },
      Em: { root: 40, tones: [55, 59, 64, 67, 71, 76, 79] },
      C:  { root: 36, tones: [55, 60, 64, 67, 72, 76, 79] },
      Am: { root: 45, tones: [57, 60, 64, 69, 72, 76] },
    },
    prog: ['G', 'D', 'Em', 'C', 'G', 'C', 'D', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'G', 'G'],
    rhythms: [[2, 1, 1, 2], [3, 1, 2], [1, 1, 2, 2], [4, 2], [2, 2, 2], [2, 1, 1, 1, 1]],
    melody: [66, 81], flute: 'mid', drone: false,
  },
];

// Мелодия на 16 тактов: сильные доли — звуки аккорда, слабые — шаг по ладу.
function composeTrack(tr, seed) {
  const r = musicRng(seed);
  const [lo, hi] = tr.melody;
  let cur = Math.round((lo + hi) / 2);
  return tr.prog.map((name, bi) => {
    const rh = tr.rhythms[(r() * tr.rhythms.length) | 0];
    const tones = tr.chords[name].tones.filter(m => m >= lo && m <= hi);
    const notes = [];
    rh.forEach((len, k) => {
      if (k === 0 || len >= 3) cur = tones.reduce((a, t) => Math.abs(t - cur) + r() * 3 < Math.abs(a - cur) ? t : a, tones[0]);
      else {
        let i = tr.scale.indexOf(cur); if (i < 0) i = tr.scale.findIndex(m => m >= cur);
        cur = tr.scale[Math.max(0, Math.min(tr.scale.length - 1, i + (r() < 0.55 ? 1 : -1)))];
        cur = Math.max(lo, Math.min(hi, cur));
      }
      // иногда пауза — лесу нужен воздух
      notes.push([r() < (tr.flute === 'low' ? 0.12 : 0.05) && k > 0 ? null : cur, len]);
    });
    if (bi % 8 === 7) notes[notes.length - 1][0] = tones[0] + (tones[0] + 12 <= hi ? 12 : 0);
    return notes;
  });
}

// ---------- Инструменты ----------

function makeImpulse(ctx, sec, decay = 2.6) {
  const len = ctx.sampleRate * sec, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// Щипковая струна (Карплус — Стронг): арфа звучит дольше и мягче гитары
function pluckBuffer(hz, sustain) {
  const key = Math.round(hz * 10) + (sustain ? 'h' : 'g');
  if (Music.buffers.has(key)) return Music.buffers.get(key);
  const ctx = Music.ctx, sr = ctx.sampleRate, len = sr * (sustain ? 3 : 1.6);
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const N = Math.round(sr / hz), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  const k = sustain ? 0.4993 : 0.4985;
  let p = 0;
  for (let i = 0; i < len; i++) {
    const nxt = (p + 1) % N;
    const v = (ring[p] + ring[nxt]) * k;
    d[i] = ring[p]; ring[p] = v; p = nxt;
  }
  Music.buffers.set(key, buf);
  return buf;
}

function harp(midi, t, vel = 0.4) {
  const ctx = Music.ctx;
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(midiHz(midi), true);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
  src.connect(f); f.connect(g); g.connect(Music.master); g.connect(Music.rev);
  src.start(t); src.stop(t + 3);
}

// Флейта. low — глубокая, тёмная, с постоянным «воздухом» и медленным вибрато.
function flute(midi, t, dur, vel, low) {
  const ctx = Music.ctx, hz = midiHz(midi);
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'sine'; o2.type = 'triangle';
  o1.frequency.value = hz; o2.frequency.value = hz * 2;
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = low ? 4.4 : 5.4;
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * (low ? 0.009 : 0.006), t + Math.min(0.5, dur * 0.6));
  lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
  const g = ctx.createGain(), g2 = ctx.createGain();
  g2.gain.value = low ? 0.06 : 0.12;
  const att = low ? 0.12 : 0.035;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + att);
  g.gain.setValueAtTime(vel * 0.85, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + (low ? 0.3 : 0.08));
  // дыхание: у низкой флейты — на всю ноту, как у деревянной лесной дудки
  const nb = ctx.createBufferSource(), nbf = ctx.createBiquadFilter(), ng = ctx.createGain();
  nb.buffer = Music.noise; nb.loop = true;
  nbf.type = 'bandpass'; nbf.frequency.value = hz * (low ? 1.5 : 2); nbf.Q.value = low ? 2.2 : 1.4;
  ng.gain.setValueAtTime(vel * (low ? 0.7 : 0.5), t);
  if (low) { ng.gain.exponentialRampToValueAtTime(vel * 0.22, t + 0.2); ng.gain.setValueAtTime(vel * 0.22, t + dur); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3); }
  else ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  nb.connect(nbf); nbf.connect(ng); ng.connect(Music.master); ng.connect(Music.hall);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = low ? 1700 : 3800;
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(Music.master);
  lp.connect(low ? Music.hall : Music.rev);
  const end = t + dur + 0.35;
  for (const n of [o1, o2, lfo]) { n.start(t); n.stop(end); }
  nb.start(t, Math.random()); nb.stop(end);
}

// Женский голос: пила через три полосовых фильтра-форманты («а» или «у»),
// вибрато, медленная атака и долгий отзвук — протяжные распевы.
const VOWELS = { a: [[800, 1, 7], [1150, 0.5, 9], [2900, 0.22, 12]], u: [[350, 1, 6], [650, 0.35, 8], [2700, 0.08, 10]] };
function voice(midi, t, dur, vel = 0.07, vowel = 'a') {
  const ctx = Music.ctx, hz = midiHz(midi);
  const o = ctx.createOscillator(), o2 = ctx.createOscillator();
  o.type = 'sawtooth'; o2.type = 'sawtooth';
  o.frequency.value = hz; o2.frequency.value = hz * 1.004;    // лёгкий хор
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 5.1;
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * 0.014, t + Math.min(0.9, dur * 0.5));
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  const mix = ctx.createGain(); mix.gain.value = 0.5;
  o.connect(mix); o2.connect(mix);
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
  sum.connect(lp); lp.connect(env);
  env.connect(Music.master); env.connect(Music.hall);
  const end = t + dur + 0.9;
  for (const n of [o, o2, lfo]) { n.start(t); n.stop(end); }
}

// Мягкие струнные / бурдон: пила через тёмный фильтр, медленные атака и спад
function pad(midis, t, dur, vel = 0.05) {
  const ctx = Music.ctx;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vel, t + dur * 0.3);
  env.gain.setValueAtTime(vel, t + dur * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
  lp.connect(env); env.connect(Music.master); env.connect(Music.hall);
  for (const m of midis) for (const det of [-4, 4]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.value = midiHz(m); o.detune.value = det;
    o.connect(lp); o.start(t); o.stop(t + dur + 0.6);
  }
}

function tambourine(t, vel) {
  const ctx = Music.ctx;
  const nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Music.noise; f.type = 'highpass'; f.frequency.value = 6500;
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  nb.connect(f); f.connect(g); g.connect(Music.master);
  nb.start(t, Math.random() * 0.5); nb.stop(t + 0.14);
}

function drum(t, vel, low = 110) {
  const ctx = Music.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(low, t); o.frequency.exponentialRampToValueAtTime(low * 0.42, t + 0.22);
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g); g.connect(Music.master); g.connect(Music.rev);
  o.start(t); o.stop(t + 0.4);
}

// ---------- Такт ----------

function scheduleBar(tr, song, bar, t) {
  const B = tr.beat, E = B / 2;                      // восьмая
  const bi = bar % tr.prog.length, ch = tr.chords[tr.prog[bi]];
  const len = B * tr.meter;
  const up = ch.tones.filter(m => m >= 50 && m < 72);
  if (tr.drone) {
    // «Чаща»: бурдон ре+ля раз в 4 такта, арфа медленно перебирает вверх-вниз
    if (bar % 4 === 0) pad([38, 45], t, len * 4, 0.045);
    const arp = [up[0], up[1], up[2], up[3] || up[1] + 12, up[2], up[1]];
    arp.forEach((m, k) => harp(m, t + k * E, k === 0 ? 0.32 : 0.2));
    if (bar % 2 === 0) harp(ch.root, t, 0.34);
    if (bar % 8 === 0) drum(t, 0.18, 70);           // далёкий удар, как в чаще
  } else {
    // «Долина»: бас на раз, арфа на два-три, струнные держат аккорд, бубен в вальс
    harp(ch.root, t, 0.36);
    harp(up[1], t + B, 0.24); harp(up[2], t + B * 1.5, 0.18); harp(up[3] || up[2] + 5, t + B * 2, 0.22);
    pad(up.slice(0, 3).map(m => m + 12), t, len, 0.022);
    drum(t, 0.16, 120);
    tambourine(t + B, 0.04); tambourine(t + B * 2, 0.04);
  }
  // флейта ведёт мелодию — кроме того куска, где поёт голос в «Чаще»
  const voiceNow = bar >= tr.voiceFrom;
  const notes = song[bi];
  if (!(tr.drone && voiceNow && bar % 8 < 6)) {
    let pos = 0;
    for (const [m, l] of notes) {
      if (m) flute(m, t + pos * E, l * E * 0.95, pos === 0 ? 0.2 : 0.15, tr.flute === 'low');
      pos += l;
    }
  }
  // женские распевы: долгие ноты на звуках аккорда, иногда терция вторым голосом
  if (voiceNow && bar % 2 === 0) {
    const vt = ch.tones.filter(m => m >= 67 && m <= 77);
    const m = vt[(bar / 2) % vt.length] || vt[0];
    if (m) {
      const vow = tr.drone ? 'a' : 'u';
      voice(m, t + (tr.drone ? 0 : E), len * 2 - E, tr.drone ? 0.075 : 0.045, vow);
      if (tr.drone && bar % 4 === 0) voice(m - (vt.includes(m - 3) ? 3 : 4), t + B, len * 2 - B, 0.05, 'a');
    }
  }
}

function musicTick() {
  if (!Music.on) return;
  const ctx = Music.ctx;
  while (Music.nextTime < ctx.currentTime + 0.5) {
    const tr = TRACKS[Music.track];
    if (Music.bar >= tr.bars) {
      // смена трека с паузой в такт
      Music.nextTime += tr.beat * tr.meter;
      Music.track = (Music.track + 1) % TRACKS.length;
      Music.bar = 0;
      const nt = TRACKS[Music.track];
      Music.songs[Music.track] = composeTrack(nt, nt.seed + Math.floor(Math.random() * 1000));
      continue;
    }
    // каждые 16 тактов — новая вариация мелодии того же характера
    if (Music.bar % 16 === 0 && Music.bar > 0) Music.songs[Music.track] = composeTrack(tr, tr.seed + Music.bar * 7);
    scheduleBar(tr, Music.songs[Music.track], Music.bar, Music.nextTime);
    Music.nextTime += tr.beat * tr.meter;
    Music.bar++;
  }
}

function startMusic() {
  if (Music.started) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  Music.started = true;
  const ctx = Music.ctx = new AC();
  Music.master = ctx.createGain(); Music.master.gain.value = 0.34;
  Music.rev = ctx.createConvolver(); Music.rev.buffer = makeImpulse(ctx, 2.2);
  const rg = ctx.createGain(); rg.gain.value = 0.3;
  Music.rev.connect(rg); rg.connect(Music.master);
  // большой лесной «зал» для флейты и голоса — таинственный длинный отзвук
  Music.hall = ctx.createConvolver(); Music.hall.buffer = makeImpulse(ctx, 4.5, 2);
  const hg = ctx.createGain(); hg.gain.value = 0.45;
  Music.hall.connect(hg); hg.connect(Music.master);
  Music.master.connect(ctx.destination);
  const nl = ctx.sampleRate * 2;
  Music.noise = ctx.createBuffer(1, nl, ctx.sampleRate);
  const nd = Music.noise.getChannelData(0);
  for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
  Music.songs = TRACKS.map(tr => composeTrack(tr, tr.seed));
  Music.track = 0; Music.bar = 0;
  Music.nextTime = ctx.currentTime + 0.15;
  Music.timer = setInterval(musicTick, 80);
  if (!Music.on) ctx.suspend();
}

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
    const sync = () => { btn.classList.toggle('active', Music.on); btn.title = Music.on ? 'Музыка: вкл' : 'Музыка: выкл'; };
    btn.onclick = (e) => { e.stopPropagation(); startMusic(); setMusic(!Music.on); sync(); };
    sync();
  }
}
