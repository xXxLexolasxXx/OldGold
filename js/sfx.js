'use strict';
// Звуки мира: синтез через WebAudio. Слышно только то, что видно на экране:
// громче ближе к центру и при приближении камеры, с панорамой влево-вправо.
// Свой переключатель (кнопка 🔊), не зависит от музыки.

const Sfx = { ctx: null, out: null, noise: null, on: true, recent: [], snoreT: 0 };

function sfxInit() {
  if (Sfx.ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = Sfx.ctx = new AC();
  Sfx.out = ctx.createGain(); Sfx.out.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
  Sfx.out.connect(comp); comp.connect(ctx.destination);
  const n = ctx.sampleRate;
  Sfx.noise = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = Sfx.noise.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  if (!Sfx.on) ctx.suspend();
}

// Громкость и панорама по положению на экране; null — не слышно
function sfxPlace(wx, wy) {
  if (!Sfx.on || !Sfx.ctx || !R.canvas) return null;
  const s = camScale(), sx = (wx - R.cam.x) * s, sy = (wy - R.cam.y) * s;
  const W = R.canvas.clientWidth, H = R.canvas.clientHeight;
  if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) return null;
  const dx = (sx - W / 2) / (W / 2), dy = (sy - H / 2) / (H / 2);
  const dist = Math.min(1, Math.hypot(dx, dy) / 1.3);
  const zoom = Math.min(1.2, 0.45 + R.cam.z * 0.22);
  return { vol: (1 - dist * 0.6) * zoom, pan: Math.max(-0.9, Math.min(0.9, dx * 0.8)) };
}

// Не больше 7 звуков за 0.15 с — чтобы стройка из 10 работяг не превращалась в кашу
function sfxBudget() {
  const t = Sfx.ctx.currentTime;
  Sfx.recent = Sfx.recent.filter(x => t - x < 0.15);
  if (Sfx.recent.length >= 7) return false;
  Sfx.recent.push(t);
  return true;
}

function sfxChain(p, vel) {
  const ctx = Sfx.ctx, g = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  g.gain.value = vel * p.vol;
  if (pan) { pan.pan.value = p.pan; g.connect(pan); pan.connect(Sfx.out); } else g.connect(Sfx.out);
  return g;
}

function tone(dest, type, f0, f1, t, len, vol, attack = 0.004) {
  const ctx = Sfx.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + 0.02);
  return o;
}

function noiseHit(dest, type, f0, f1, q, t, len, vol, attack = 0.002) {
  const ctx = Sfx.ctx, nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Sfx.noise; nb.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  nb.connect(f); f.connect(g); g.connect(dest); nb.start(t, Math.random() * 0.5); nb.stop(t + len + 0.02);
}

// «Голосок» гнома: пила через формант — короткие возгласы
function gnomeVoice(dest, t, notes, vol, formant = 1100) {
  const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(), g = ctx.createGain();
  bp.type = 'bandpass'; bp.frequency.value = formant; bp.Q.value = 3;
  g.gain.value = vol * 2.2; bp.connect(g); g.connect(dest);
  let tt = t;
  for (const [f0, f1, len] of notes) { tone(bp, 'sawtooth', f0, f1, tt, len, 0.6, 0.015); tt += len * 0.9; }
}

const SFX = {
  build: (d, t) => { tone(d, 'sine', 900, 260, t, 0.09, 0.5); noiseHit(d, 'bandpass', 2500, 1200, 2, t, 0.05, 0.35); },       // молоток по дереву
  chop: (d, t) => { tone(d, 'triangle', 220, 90, t, 0.12, 0.55); noiseHit(d, 'bandpass', 1800, 700, 1.5, t, 0.09, 0.45); },    // топор
  mine: (d, t) => { tone(d, 'sine', 2300, 2200, t, 0.25, 0.25); tone(d, 'sine', 3450, 3400, t, 0.18, 0.12); noiseHit(d, 'highpass', 4000, 4000, 1, t, 0.03, 0.3); }, // кирка о камень
  dig: (d, t) => { noiseHit(d, 'bandpass', 600, 1400, 1.2, t, 0.22, 0.45, 0.03); tone(d, 'sine', 160, 110, t + 0.05, 0.08, 0.2); },  // лопата в землю
  reap: (d, t) => noiseHit(d, 'highpass', 2500, 6000, 0.8, t, 0.18, 0.3, 0.05),                                               // серп
  forage: (d, t) => { tone(d, 'sine', 500, 900, t, 0.06, 0.25); noiseHit(d, 'bandpass', 1500, 1500, 3, t, 0.04, 0.15); },        // сорвал грибок
  smoke: (d, t) => noiseHit(d, 'lowpass', 900, 300, 0.7, t, 0.7, 0.18, 0.2),                                                   // затяжка и выдох
  snore: (d, t) => { const o = tone(d, 'sawtooth', 85, 70, t, 0.9, 0.12, 0.35); void o; noiseHit(d, 'lowpass', 500, 300, 1, t + 0.1, 0.7, 0.1, 0.3); },
  hic: (d, t) => gnomeVoice(d, t, [[300, 520, 0.08]], 0.5, 900),
  ouch: (d, t) => gnomeVoice(d, t, [[700, 950, 0.07], [950, 600, 0.12]], 0.55, 1300),
  hey: (d, t) => gnomeVoice(d, t, [[420, 560, 0.08], [560, 520, 0.12]], 0.45, 1000),
  grr: (d, t) => gnomeVoice(d, t, [[180, 150, 0.25]], 0.5, 700),
  groan: (d, t) => gnomeVoice(d, t, [[260, 160, 0.6]], 0.5, 650),
  honk: (d, t) => { for (const k of [0, 0.16]) { const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 4; bp.connect(d); tone(bp, 'sawtooth', 340, 300, t + k, 0.12, 0.9, 0.01); } },
  hoot: (d, t) => { tone(d, 'sine', 400, 370, t, 0.32, 0.4, 0.06); tone(d, 'sine', 380, 340, t + 0.45, 0.5, 0.35, 0.08); },
  cluck: (d, t) => { for (const k of [0, 0.09, 0.2]) tone(d, 'square', 700 + Math.random() * 200, 500, t + k, 0.05, 0.12); },
  thud: (d, t) => { tone(d, 'sine', 140, 55, t, 0.2, 0.6); noiseHit(d, 'lowpass', 700, 200, 1, t, 0.12, 0.35); },
  glass: (d, t) => { noiseHit(d, 'highpass', 5000, 7000, 1, t, 0.12, 0.4); for (const [f, k] of [[3100, 0], [4200, 0.04], [2600, 0.09]]) tone(d, 'sine', f, f * 0.9, t + k, 0.15, 0.14); },   // разбитый фонарь
  creak: (d, t) => { const ctx = Sfx.ctx, lp = ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 420; lp.Q.value = 6; lp.connect(d); tone(lp, 'sawtooth', 70, 110, t, 0.9, 0.7, 0.2); tone(lp, 'sawtooth', 95, 60, t + 0.5, 0.7, 0.5, 0.15); },   // скрип ожившего дерева
  roar: (d, t) => { noiseHit(d, 'lowpass', 500, 160, 0.8, t, 1.1, 0.6, 0.12); tone(d, 'sawtooth', 60, 40, t, 1, 0.3, 0.1); },
  scream: (d, t) => gnomeVoice(d, t, [[700, 1100, 0.18], [1100, 650, 0.35]], 0.6, 1500),
  five: (d, t) => { noiseHit(d, 'bandpass', 2400, 1400, 1.6, t, 0.07, 0.7, 0.002); tone(d, 'sine', 900, 300, t, 0.08, 0.35); },   // хлопок ладоней
  chime: (d, t) => { for (const [f, k] of [[1320, 0], [1760, 0.08], [2640, 0.16]]) tone(d, 'sine', f, f, t + k, 0.5, 0.2); },
};

function sfxAt(kind, wx, wy, vel = 1, delay = 0) {
  if (!Sfx.ctx || !SFX[kind]) return;
  const p = sfxPlace(wx, wy);
  if (!p || p.vol < 0.05 || !sfxBudget()) return;
  const t = Sfx.ctx.currentTime + 0.01 + delay + Math.random() * 0.02;
  SFX[kind](sfxChain(p, vel), t);
}

// Звук жителя по анимации (центр клетки → мировые пиксели)
const ANIM_SFX = { build: 'build', chop: 'chop', mine: 'mine', dig: 'dig', reap: 'reap', hoppick: 'forage', forage: 'forage', smoke: 'smoke', faint: 'groan' };
function sfxUnit(u, kind, delay = 0) { if (!u.inside) sfxAt(ANIM_SFX[kind] || kind, u.x * TILE, u.y * TILE, 1, delay / Math.max(1, Game.speed)); }

// Возгласы по всплывающим надписям
const FLOAT_SFX = { 'Дзынь!': 'glass', 'А-а-а!': 'scream', 'Ой!': 'ouch', 'Хрясь!': 'chop', 'Га-га!': 'honk', 'У-ху!': 'hoot', 'Ай!': 'ouch', 'Ко-ко!': 'cluck', 'Бух!': 'thud', 'Золото!': 'chime' };
function sfxFloater(text, x, y) { if (FLOAT_SFX[text]) sfxAt(FLOAT_SFX[text], x * TILE, y * TILE); }

// Периодические звуки: храп спящих, икота пьяных
function sfxTick(dt) {
  if (!Sfx.ctx || !Sfx.on) return;
  Sfx.snoreT += dt;
  if (Sfx.snoreT < 1.6) return;
  Sfx.snoreT = 0;
  for (const u of Game.units) {
    if (u.inside) continue;
    if (u.anim === 'sleep' && Math.random() < 0.6) sfxAt('snore', u.x * TILE, u.y * TILE, 0.8);
    else if (u.drunkAt && Math.random() < 0.35) sfxAt('hic', u.x * TILE, u.y * TILE);
  }
}

function setSfx(on) {
  Sfx.on = on;
  try { localStorage.setItem('feod.sfx', on ? '1' : '0'); } catch (e) { /* нет доступа к хранилищу */ }
  if (Sfx.ctx) { if (on) Sfx.ctx.resume(); else Sfx.ctx.suspend(); }
}

function initSfx() {
  try { Sfx.on = localStorage.getItem('feod.sfx') !== '0'; } catch (e) { Sfx.on = true; }
  const kick = () => { sfxInit(); window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
  const btn = document.getElementById('sfx-btn');
  if (btn) {
    const sync = () => { btn.classList.toggle('active', Sfx.on); btn.textContent = Sfx.on ? '🔊' : '🔈'; btn.title = Sfx.on ? 'Звуки: вкл' : 'Звуки: выкл'; };
    btn.onclick = (e) => { e.stopPropagation(); sfxInit(); setSfx(!Sfx.on); sync(); };
    sync();
  }
}

// Аплодисменты: много коротких хлопков вразнобой и пара довольных возгласов
function sfxApplause(amount = 1) {
  if (!Sfx.ctx || !Sfx.on) return;
  const t0 = Sfx.ctx.currentTime + 0.02, out = Sfx.out;
  const n = Math.round(25 + 55 * amount);
  for (let k = 0; k < n; k++) {
    const t = t0 + Math.pow(Math.random(), 0.8) * 2.8;
    noiseHit(out, 'bandpass', 1100 + Math.random() * 1600, 900 + Math.random() * 900, 1.4, t, 0.035 + Math.random() * 0.03, 0.06 + Math.random() * 0.1 * amount);
  }
  for (let k = 0; k < 3; k++) gnomeVoice(out, t0 + 0.2 + k * 0.5 + Math.random() * 0.3, [[420 + k * 60, 620, 0.1], [620, 560, 0.18]], 0.12, 1100);
}
