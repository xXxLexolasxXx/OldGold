'use strict';
// Музыка эльфийского трактира: флейта ведёт весёлую джигу (6/8, ре мажор),
// гитара перебирает аккорды, мягкий бубен держит ритм. Всё синтезируется
// через WebAudio, никаких файлов. Запускается после первого клика игрока.

const Music = {
  ctx: null, master: null, rev: null, on: true, started: false,
  bar: 0, nextTime: 0, timer: null, buffers: new Map(), song: null,
};

const EIGHTH = 0.19;             // длительность восьмой, сек (≈105 ударов в минуту по четвертям с точкой)
const BAR = EIGHTH * 6;          // такт 6/8

// Ноты: MIDI-номера
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
const D_MAJOR = [62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81, 83, 85, 86];   // D4..D6
const CHORDS = {
  D:  { root: 50, tones: [62, 66, 69, 74, 78, 81, 86] },
  G:  { root: 43, tones: [62, 67, 71, 74, 79, 83, 86] },
  A:  { root: 45, tones: [64, 69, 73, 76, 81, 85] },
  Bm: { root: 47, tones: [62, 66, 71, 74, 78, 83, 86] },
  Em: { root: 52, tones: [64, 67, 71, 76, 79, 83] },
};
// Форма: A A B A (по 4 такта), аккорды по тактам
const FORM = [
  ['D', 'G', 'D', 'A'], ['D', 'G', 'A', 'D'],
  ['Bm', 'G', 'D', 'A'], ['D', 'Em', 'A', 'D'],
];
// Ритмы такта 6/8 в восьмых
const RHYTHMS = [[2, 1, 2, 1], [1, 1, 1, 1, 1, 1], [3, 3], [2, 1, 1, 1, 1], [1, 1, 1, 3], [3, 2, 1]];

function musicRng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Сочиняем мотивы один раз: фраза A и фраза B, остальное — вариации.
function composeSong(seed) {
  const r = musicRng(seed);
  const phrase = (chords) => chords.map((ch, bi) => {
    const rh = RHYTHMS[(r() * RHYTHMS.length) | 0];
    const tones = CHORDS[ch].tones.filter(m => m >= 66 && m <= 86);
    let cur = tones[(r() * tones.length) | 0];
    const notes = [];
    rh.forEach((len, k) => {
      // сильные доли — звуки аккорда, слабые — проходящие по гамме
      if (k === 0 || len >= 2) cur = tones.reduce((a, t) => Math.abs(t - cur) < Math.abs(a - cur) + r() * 4 ? t : a, tones[0]);
      else { const i = D_MAJOR.indexOf(cur); const step = r() < 0.5 ? 1 : -1; cur = D_MAJOR[Math.max(0, Math.min(D_MAJOR.length - 1, (i < 0 ? 4 : i) + step))]; }
      notes.push([cur, len]);
    });
    // последний такт фразы — на тонику
    if (bi === chords.length - 1 && ch === 'D') notes[notes.length - 1][0] = 74;
    return notes;
  });
  const A = phrase(FORM[0]), A2 = phrase(FORM[1]), B = phrase(FORM[2]), B2 = phrase(FORM[3]);
  return [A, A2, B, B2];
}

function makeImpulse(ctx, sec) {
  const len = ctx.sampleRate * sec, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

// Щипковая струна (Карплус — Стронг), кэш по частоте
function pluckBuffer(hz) {
  const key = Math.round(hz * 10);
  if (Music.buffers.has(key)) return Music.buffers.get(key);
  const ctx = Music.ctx, sr = ctx.sampleRate, len = sr * 1.6;
  const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
  const N = Math.round(sr / hz), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  let p = 0;
  for (let i = 0; i < len; i++) {
    const nxt = (p + 1) % N;
    const v = (ring[p] + ring[nxt]) * 0.4985;
    d[i] = ring[p];
    ring[p] = v;
    p = nxt;
  }
  Music.buffers.set(key, buf);
  return buf;
}

function pluck(midi, t, vel = 0.5) {
  const ctx = Music.ctx;
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(midiHz(midi));
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
  src.connect(f); f.connect(g); g.connect(Music.master); g.connect(Music.rev);
  src.start(t); src.stop(t + 1.6);
}

function flute(midi, t, dur, vel = 0.22) {
  const ctx = Music.ctx, hz = midiHz(midi);
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
  o1.type = 'sine'; o2.type = 'triangle';
  o1.frequency.value = hz; o2.frequency.value = hz * 2;
  // вибрато вступает чуть позже атаки
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 5.4; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * 0.006, t + Math.min(0.25, dur * 0.6));
  lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
  const g = ctx.createGain(), g2 = ctx.createGain();
  g2.gain.value = 0.12;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.035);
  g.gain.setValueAtTime(vel * 0.85, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  // дыхание в начале ноты
  const nb = ctx.createBufferSource(), nbf = ctx.createBiquadFilter(), ng = ctx.createGain();
  nb.buffer = Music.noise; nbf.type = 'bandpass'; nbf.frequency.value = hz * 2; nbf.Q.value = 1.4;
  ng.gain.setValueAtTime(vel * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  nb.connect(nbf); nbf.connect(ng); ng.connect(Music.master);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(Music.master); lp.connect(Music.rev);
  for (const n of [o1, o2, lfo]) { n.start(t); n.stop(t + dur + 0.12); }
  nb.start(t); nb.stop(t + 0.1);
}

function tambourine(t, vel) {
  const ctx = Music.ctx;
  const nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Music.noise; f.type = 'highpass'; f.frequency.value = 6500;
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  nb.connect(f); f.connect(g); g.connect(Music.master);
  nb.start(t); nb.stop(t + 0.14);
}

function drum(t, vel) {
  const ctx = Music.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.connect(g); g.connect(Music.master);
  o.start(t); o.stop(t + 0.3);
}

function scheduleBar(barIdx, t) {
  const section = Math.floor(barIdx / 4) % 4, bi = barIdx % 4;
  // каждые 16 тактов слегка переиначиваем мелодию
  if (barIdx % 16 === 0) Music.song = composeSong(1000 + Math.floor(barIdx / 32));
  const chordName = FORM[section][bi], ch = CHORDS[chordName];
  // гитара: бас на 1, перебор на 3, 4, 6
  pluck(ch.root, t, 0.55);
  const up = ch.tones.filter(m => m < 76);
  pluck(up[0] - 12, t + EIGHTH * 2, 0.3);
  pluck(up[1] - 12, t + EIGHTH * 3, 0.35);
  pluck(ch.root + 7, t + EIGHTH * 3, 0.3);
  pluck(up[2 % up.length] - 12, t + EIGHTH * 5, 0.3);
  // ритм
  drum(t, 0.35); drum(t + EIGHTH * 3, 0.25);
  for (let k = 0; k < 6; k++) tambourine(t + EIGHTH * k, k === 0 || k === 3 ? 0.08 : 0.035);
  // флейта
  const notes = Music.song[section][bi];
  let pos = 0;
  for (const [m, len] of notes) {
    const accent = pos === 0 || pos === 3;
    flute(m, t + pos * EIGHTH, len * EIGHTH * 0.92, accent ? 0.24 : 0.18);
    pos += len;
  }
}

function musicTick() {
  if (!Music.on) return;
  const ctx = Music.ctx;
  while (Music.nextTime < ctx.currentTime + 0.4) {
    scheduleBar(Music.bar, Music.nextTime);
    Music.bar++;
    Music.nextTime += BAR;
  }
}

function startMusic() {
  if (Music.started) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  Music.started = true;
  const ctx = Music.ctx = new AC();
  Music.master = ctx.createGain(); Music.master.gain.value = 0.32;
  Music.rev = ctx.createConvolver(); Music.rev.buffer = makeImpulse(ctx, 2.2);
  const rg = ctx.createGain(); rg.gain.value = 0.32;
  Music.rev.connect(rg); rg.connect(Music.master);
  Music.master.connect(ctx.destination);
  const nl = ctx.sampleRate;
  Music.noise = ctx.createBuffer(1, nl, ctx.sampleRate);
  const nd = Music.noise.getChannelData(0);
  for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
  Music.song = composeSong(1000);
  Music.nextTime = ctx.currentTime + 0.1;
  Music.timer = setInterval(musicTick, 60);
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
