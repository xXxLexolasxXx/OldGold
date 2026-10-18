'use strict';
// Звуки мира: синтез через WebAudio на общем аудио-ядре (music.js).
// Слышно только то, что видно на экране: чем ближе к центру и чем крупнее камера, тем громче;
// далёкое звучит глуше (срез верха) и с «воздухом» (короткая реверберация), панорама влево-вправо.
// Голоса ограничены: не больше SFX_MAX_VOICES одновременно, у каждого вида звука своя полифония
// и приоритет — тихие и неважные уступают место громким и важным, без обрыва со щелчком.
// Свой переключатель (кнопка 🔊), не зависит от музыки.

const Sfx = { ctx: null, out: null, verb: null, noise: null, on: true, voices: [], kindT: new Map(), snoreT: 0, stepT: 0, steps: new WeakMap(), amb: null, fireT: 0 };

const SFX_MAX_VOICES = 22;

function sfxInit() {
  if (Sfx.ctx) return;
  const ctx = audioCoreInit();
  if (!ctx) return;
  Sfx.ctx = ctx; Sfx.noise = AudioCore.noise;
  // шина мира: мягкий компрессор склеивает удары стройки, затем в общую шину звуков
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.18;
  Sfx.out = ctx.createGain(); Sfx.out.gain.value = 0.7;
  Sfx.out.connect(comp); comp.connect(AudioCore.sfx);
  // «воздух»: короткая уличная реверберация для далёких звуков и призраков
  Sfx.verb = ctx.createConvolver(); Sfx.verb.buffer = makeImpulse(ctx, 1.1, 3.2);
  const vg = ctx.createGain(); vg.gain.value = 0.55; Sfx.verb.connect(vg); vg.connect(comp);
  audioSetBus('sfx', Sfx.on);
}

// ---------- Пространство ----------
// Положение на экране → громкость, панорама, глухость и доля «воздуха»; null — не слышно
function sfxPlace(wx, wy) {
  if (!Sfx.on || !Sfx.ctx || !R.canvas) return null;
  const s = camScale(), W = R.canvas.clientWidth, H = R.canvas.clientHeight;
  if (!(W > 0 && H > 0 && s > 0)) return null;           // холст свёрнут/ещё без размера — деление на ноль дало бы NaN в аудио-параметрах
  const sx = (wx - R.cam.x) * s, sy = (wy - R.cam.y) * s;
  const m = Math.min(W, H) * 0.2;                        // чуть-чуть слышно и за краем экрана
  if (sx < -m || sy < -m || sx > W + m || sy > H + m) return null;
  const dx = (sx - W / 2) / (W / 2), dy = (sy - H / 2) / (H / 2);
  const d = Math.hypot(dx, dy * 1.15);                   // 0 — центр, ≈1 — край
  // полная громкость в центральной трети, дальше спад по квадрату (как в жизни), без обрыва у края
  const u = Math.max(0, Math.min(1, (d - 0.3) / 1.0));
  const att = 1 / (1 + 3.2 * u * u);
  const zoom = Math.min(1.25, Math.max(0.45, 0.35 + R.cam.z * 0.3));
  return {
    vol: att * zoom,
    pan: Math.max(-0.9, Math.min(0.9, dx * 0.85)),
    lp: (16000 - u * 13000) * Math.min(1, 0.6 + R.cam.z * 0.2),   // далёкое и мелкое — глуше
    wet: 0.06 + u * 0.3,
    far: u,
  };
}

// ---------- Таблица звуков ----------
// pri — приоритет (выше важнее), gain — уровень, poly — сколько таких одновременно,
// cd — минимальный промежуток между одинаковыми (с), len — примерная длительность, wet — свой «воздух»
const SFX_DEFAULT = { pri: 1, gain: 0.45, poly: 3, cd: 0.03, len: 1, wet: 0 };
const SFX_DEF = {
  build:  { pri: 1, gain: 0.5, poly: 3, cd: 0.04, len: 0.3 },
  chop:   { pri: 1, gain: 0.55, poly: 3, cd: 0.05, len: 0.35 },
  mine:   { pri: 1, gain: 0.42, poly: 3, cd: 0.05, len: 0.4 },
  dig:    { pri: 1, gain: 0.45, poly: 3, cd: 0.05, len: 0.5 },
  reap:   { pri: 1, gain: 0.8, poly: 3, cd: 0.05, len: 0.3 },
  forage: { pri: 1, gain: 0.35, poly: 3, cd: 0.05, len: 0.2 },
  step:   { pri: 0, gain: 0.5, poly: 4, cd: 0.02, len: 0.12 },
  stepRoad: { pri: 0, gain: 0.3, poly: 4, cd: 0.02, len: 0.12 },
  smoke:  { pri: 0, gain: 0.6, poly: 2, cd: 0.3, len: 1 },
  snore:  { pri: 0, gain: 0.35, poly: 2, cd: 0.4, len: 1.6 },
  hic:    { pri: 2, gain: 0.45, poly: 2, cd: 0.1, len: 0.3 },
  ouch:   { pri: 2, gain: 0.5, poly: 2, cd: 0.08, len: 0.4 },
  hey:    { pri: 2, gain: 0.45, poly: 2, cd: 0.08, len: 0.4 },
  grr:    { pri: 2, gain: 0.5, poly: 2, cd: 0.1, len: 0.5 },
  groan:  { pri: 2, gain: 0.5, poly: 2, cd: 0.1, len: 0.9 },
  scream: { pri: 3, gain: 0.5, poly: 2, cd: 0.1, len: 0.8 },
  honk:   { pri: 2, gain: 0.45, poly: 2, cd: 0.1, len: 0.5 },
  hoot:   { pri: 1, gain: 0.4, poly: 2, cd: 0.3, len: 1.2 },
  cluck:  { pri: 1, gain: 0.35, poly: 3, cd: 0.05, len: 0.4 },
  thud:   { pri: 2, gain: 0.55, poly: 3, cd: 0.04, len: 0.4 },
  glass:  { pri: 2, gain: 0.45, poly: 2, cd: 0.1, len: 0.6 },
  creak:  { pri: 3, gain: 0.85, poly: 2, cd: 0.2, len: 1.4, wet: 0.25 },
  roar:   { pri: 3, gain: 0.6, poly: 2, cd: 0.3, len: 1.5, wet: 0.3 },
  rattle: { pri: 3, gain: 0.5, poly: 2, cd: 0.1, len: 0.7 },
  wail:   { pri: 3, gain: 0.85, poly: 2, cd: 0.4, len: 2.2, wet: 0.7 },
  squeak: { pri: 1, gain: 0.4, poly: 2, cd: 0.1, len: 0.3 },
  five:   { pri: 2, gain: 0.45, poly: 2, cd: 0.05, len: 0.2 },
  chime:  { pri: 2, gain: 0.4, poly: 2, cd: 0.1, len: 1.2, wet: 0.3 },
  crackle: { pri: 0, gain: 0.5, poly: 4, cd: 0.02, len: 0.3 },
  hiss:   { pri: 1, gain: 0.35, poly: 2, cd: 0.1, len: 1 },
  whoosh: { pri: 1, gain: 0.5, poly: 2, cd: 0.1, len: 0.5 },
};

// ---------- Голоса ----------
// Цепочка одного звука: синтез → громкость → срез верха → панорама → шина мира (+ немного в «воздух»)
function sfxChain(p, vel, def) {
  const ctx = Sfx.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
  g.gain.value = vel * p.vol * def.gain;
  lp.type = 'lowpass'; lp.frequency.value = Math.max(1200, p.lp); lp.Q.value = 0.3;
  g.connect(lp);
  let last = lp;
  if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.value = p.pan; lp.connect(pan); last = pan; }
  last.connect(Sfx.out);
  const wet = Math.max(p.wet, def.wet || 0);
  if (wet > 0.02 && Sfx.verb) { const wg = ctx.createGain(); wg.gain.value = wet; last.connect(wg); wg.connect(Sfx.verb); }
  return g;
}

// Занять голос с учётом лимитов; вернёт узел-приёмник или null (звук пропускается)
function sfxVoice(kind, def, p, vel, delay = 0) {
  const ctx = Sfx.ctx, t = ctx.currentTime;
  if (ctx.state !== 'running' || document.hidden) return null;     // пока контекст спит, звуки не копим
  Sfx.voices = Sfx.voices.filter(v => v.end > t);
  const when = t + delay, times = (Sfx.kindT.get(kind) || []).filter(x => x > t - 1);
  if (times.some(x => Math.abs(x - when) < def.cd)) return null;
  const loud = vel * p.vol * def.gain;
  const steal = (v) => { const g = v.g.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + 0.03); v.end = t; };
  const same = Sfx.voices.filter(v => v.kind === kind);
  if (same.length >= def.poly) {
    const q = same.reduce((a, v) => v.loud < a.loud ? v : a);
    if (q.loud < loud * 0.85) steal(q); else return null;      // новый тише уже звучащих — пропускаем
  }
  if (Sfx.voices.filter(v => v.end > t).length >= SFX_MAX_VOICES) {
    const cands = Sfx.voices.filter(v => v.end > t && (v.pri < def.pri || (v.pri === def.pri && v.loud < loud)));
    if (!cands.length) return null;
    steal(cands.reduce((a, v) => (v.pri < a.pri || (v.pri === a.pri && v.loud < a.loud)) ? v : a));
  }
  const g = sfxChain(p, vel, def);
  Sfx.voices.push({ kind, pri: def.pri, loud, end: t + delay + def.len + 0.1, g });
  times.push(when); Sfx.kindT.set(kind, times);
  return g;
}

// ---------- Кирпичики синтеза ----------

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
  nb.connect(f); f.connect(g); g.connect(dest); nb.start(t, Math.random() * 1.5); nb.stop(t + len + 0.02);
  return g;
}

// Резонансы тела (дерево, камень, кость, стекло): набор затухающих синусов [[частота, доля, время спада]]
function modal(dest, t, parts, vol, attack = 0.003) {
  const ctx = Sfx.ctx;
  for (const [f, a, dec] of parts) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * a, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dec + 0.02);
  }
}

// Дыхание/шорох: шум через низкий фильтр с медленной огибающей
function breath(dest, t, len, f0, f1, vol, attack = 0.1) {
  return noiseHit(dest, 'lowpass', f0, f1, 0.7, t, len, vol, attack);
}

// «Голосок» гнома: гортанный импульс (пила) через два форманта, лёгкое вибрато и придыхание.
// notes — [[от Гц, до Гц, длительность]]; formant — «окраска» гласной (ниже — «о/у», выше — «а/э»)
function gnomeVoice(dest, t, notes, vol, formant = 1100) {
  const ctx = Sfx.ctx, sum = ctx.createGain();
  sum.gain.value = vol * 2.8; sum.connect(dest);
  const src = ctx.createGain();                                  // общий вход формантов
  for (const [f, q, a] of [[formant * 0.6, 5, 1], [formant * 1.2, 7, 0.55], [2700, 9, 0.12]]) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const g = ctx.createGain(); g.gain.value = a;
    src.connect(bp); bp.connect(g); g.connect(sum);
  }
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 5.5 + Math.random(); lg.gain.value = 0; lfo.connect(lg);
  let tt = t, total = 0;
  for (const [f0, f1, len] of notes) {
    const j = 0.97 + Math.random() * 0.06;                       // каждый возглас чуть другой
    const o = tone(src, 'sawtooth', f0 * j, f1 * j, tt, len, 0.6, 0.012);
    lg.connect(o.frequency);
    tt += len * 0.9; total = tt - t;
  }
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(6, t + Math.min(0.25, total));
  lfo.start(t); lfo.stop(t + total + 0.1);
  breath(sum, t, Math.min(0.12, total), 1800, 900, 0.08, 0.01);   // придыхание на старте
}

// ---------- Звуки ----------
// Каждый звук получает (приёмник, время, случайное число 0..1 для вариации)

const SFX = {
  // молоток по дереву: глухой «тук» с коротким деревянным отзвуком
  build: (d, t, v) => {
    const r = 0.92 + v * 0.16;
    tone(d, 'sine', 420 * r, 150 * r, t, 0.07, 0.5, 0.003);
    modal(d, t, [[610 * r, 0.5, 0.07], [1180 * r, 0.3, 0.05], [2300 * r, 0.1, 0.03]], 0.35);
    noiseHit(d, 'bandpass', 1400 * r, 900, 1.5, t, 0.03, 0.25, 0.002);
  },
  // топор: «хрясь» лезвия, тело бревна, гул древесины и щепки
  chop: (d, t, v) => {
    const r = 0.9 + v * 0.2;
    noiseHit(d, 'bandpass', 1100 * r, 500, 1, t, 0.045, 0.5, 0.002);
    tone(d, 'triangle', 190 * r, 70, t, 0.11, 0.5, 0.003);
    modal(d, t + 0.01, [[520 * r, 0.35, 0.14], [1450 * r, 0.15, 0.09]], 0.3);
    noiseHit(d, 'highpass', 3000, 2000, 0.7, t + 0.02, 0.08, 0.12, 0.01);
  },
  // кирка о камень: чирк, звон металла, удар в камень и осыпь крошки
  mine: (d, t, v) => {
    const r = 0.94 + v * 0.12;
    noiseHit(d, 'highpass', 3500, 3500, 0.8, t, 0.018, 0.3, 0.001);
    modal(d, t, [[2350 * r, 0.4, 0.18], [3120 * r, 0.25, 0.13], [4700 * r, 0.1, 0.08]], 0.22);
    tone(d, 'sine', 260 * r, 110, t, 0.06, 0.35, 0.003);
    noiseHit(d, 'lowpass', 1200, 400, 0.8, t + 0.03, 0.14, 0.22, 0.02);
  },
  // лопата: входит в землю, и земля ссыпается
  dig: (d, t, v) => {
    const r = 0.9 + v * 0.2;
    noiseHit(d, 'bandpass', 900 * r, 250, 1.1, t, 0.2, 0.45, 0.025);
    tone(d, 'sine', 150 * r, 90, t + 0.02, 0.1, 0.25, 0.01);
    noiseHit(d, 'lowpass', 700, 300, 0.7, t + 0.22, 0.16, 0.2, 0.05);
  },
  // серп: взмах и хруст стеблей
  reap: (d, t, v) => {
    noiseHit(d, 'bandpass', 1800 + v * 600, 5500, 1.2, t, 0.16, 0.28, 0.06);
    for (const k of [0.09, 0.13, 0.16]) noiseHit(d, 'highpass', 4500, 3000, 2, t + k, 0.012, 0.12, 0.002);
  },
  // сорвал: мягкий «чпок» и шелест листьев
  forage: (d, t, v) => {
    tone(d, 'sine', 420 + v * 200, 900, t, 0.05, 0.25, 0.003);
    noiseHit(d, 'bandpass', 2500, 1500, 1.5, t + 0.02, 0.1, 0.15, 0.01);
  },
  // шаг по траве: мягкий шорох
  step: (d, t, v) => noiseHit(d, 'lowpass', 600 + v * 300, 200, 0.7, t, 0.045, 0.4, 0.004),
  // шаг по дороге: короткий «ток» подошвы о камень
  stepRoad: (d, t, v) => { tone(d, 'sine', 170 + v * 40, 90, t, 0.035, 0.3, 0.002); noiseHit(d, 'bandpass', 1100 + v * 300, 700, 1.2, t, 0.02, 0.25, 0.002); },
  // затяжка и выдох
  smoke: (d, t) => breath(d, t, 0.7, 900, 300, 0.45, 0.2),
  // храп: дребезжащий вдох и свистящий выдох
  snore: (d, t, v) => {
    const ctx = Sfx.ctx, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(d);
    const o = tone(lp, 'sawtooth', 78 + v * 10, 66, t, 0.75, 0.3, 0.3);
    const am = ctx.createOscillator(), ag = ctx.createGain(); am.frequency.value = 24; ag.gain.value = 10; am.connect(ag); ag.connect(o.frequency); am.start(t); am.stop(t + 0.8);
    breath(lp, t + 0.05, 0.7, 700, 300, 0.12, 0.3);
    tone(d, 'sine', 1300, 1100, t + 0.95, 0.5, 0.05, 0.15);
  },
  hic: (d, t) => gnomeVoice(d, t, [[240, 460, 0.07]], 0.5, 900),
  ouch: (d, t) => gnomeVoice(d, t, [[520, 760, 0.07], [760, 420, 0.13]], 0.55, 1250),
  hey: (d, t) => gnomeVoice(d, t, [[300, 420, 0.09], [420, 380, 0.13]], 0.45, 1000),
  grr: (d, t) => gnomeVoice(d, t, [[150, 125, 0.3]], 0.5, 650),
  groan: (d, t) => gnomeVoice(d, t, [[230, 140, 0.65]], 0.5, 600),
  scream: (d, t) => gnomeVoice(d, t, [[600, 980, 0.18], [980, 560, 0.4]], 0.6, 1450),
  // гусь: хриплый двойной гогот
  honk: (d, t, v) => {
    const ctx = Sfx.ctx;
    for (const k of [0, 0.17]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1000 + v * 200; bp.Q.value = 3; bp.connect(d);
      const o = tone(bp, 'sawtooth', 330 + v * 40, 280, t + k, 0.13, 0.8, 0.01);
      const am = ctx.createOscillator(), ag = ctx.createGain(); am.frequency.value = 55; ag.gain.value = 25; am.connect(ag); ag.connect(o.frequency); am.start(t + k); am.stop(t + k + 0.15);
      noiseHit(bp, 'bandpass', 1500, 1000, 1, t + k, 0.1, 0.2, 0.01);
    }
  },
  // сова: два мягких уханья с придыханием
  hoot: (d, t, v) => {
    const r = 0.95 + v * 0.1;
    tone(d, 'sine', 400 * r, 365 * r, t, 0.3, 0.4, 0.06); breath(d, t, 0.25, 900, 500, 0.06, 0.05);
    tone(d, 'sine', 385 * r, 330 * r, t + 0.42, 0.5, 0.36, 0.08); breath(d, t + 0.42, 0.4, 900, 500, 0.05, 0.08);
  },
  // курица: короткие кудахтанья
  cluck: (d, t, v) => { for (const k of [0, 0.09, 0.2]) { const f = 650 + v * 250 + k * 300; tone(d, 'square', f, f * 0.7, t + k, 0.045, 0.1); tone(d, 'sine', f * 0.5, f * 0.4, t + k, 0.05, 0.12); } },
  // падение тела: удар в землю
  thud: (d, t, v) => { tone(d, 'sine', 130 + v * 20, 48, t, 0.2, 0.6, 0.003); noiseHit(d, 'lowpass', 700, 180, 1, t, 0.12, 0.35); noiseHit(d, 'bandpass', 2200, 900, 1, t, 0.025, 0.15, 0.002); },
  // разбитый фонарь: звон осколков
  glass: (d, t, v) => {
    noiseHit(d, 'highpass', 5000, 7000, 1, t, 0.12, 0.35);
    modal(d, t, [[3100 + v * 400, 0.5, 0.35], [4300 + v * 500, 0.35, 0.25], [5600, 0.2, 0.18]], 0.22);
    for (let k = 0; k < 5; k++) { const f = 3500 + Math.random() * 4000; modal(d, t + 0.08 + Math.random() * 0.3, [[f, 1, 0.12]], 0.08); }
  },
  // скрип ожившего дерева: тянущийся стон древесины и треск волокон
  creak: (d, t, v) => {
    const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7; bp.connect(d);
    bp.frequency.setValueAtTime(320 + v * 80, t); bp.frequency.linearRampToValueAtTime(620, t + 0.6); bp.frequency.linearRampToValueAtTime(380, t + 1.3);
    tone(bp, 'sawtooth', 62 + v * 10, 115, t, 0.85, 0.7, 0.2);
    tone(bp, 'sawtooth', 100, 58, t + 0.55, 0.75, 0.5, 0.15);
    for (let k = 0; k < 7; k++) noiseHit(d, 'bandpass', 1500 + Math.random() * 1500, 900, 4, t + 0.1 + Math.random() * 1.1, 0.012, 0.18, 0.001);
    breath(d, t, 1.3, 400, 150, 0.1, 0.3);
  },
  // рык камня/дерева: низкий гул, рычащие форманты и вибрация
  roar: (d, t, v) => {
    const ctx = Sfx.ctx, sum = ctx.createGain(); sum.connect(d);
    for (const [f, q] of [[330 + v * 60, 4], [820, 5]]) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; bp.connect(sum); const o = tone(bp, 'sawtooth', 68, 44, t, 1.1, 0.5, 0.12); const am = ctx.createOscillator(), ag = ctx.createGain(); am.frequency.value = 23; ag.gain.value = 9; am.connect(ag); ag.connect(o.frequency); am.start(t); am.stop(t + 1.2); }
    noiseHit(d, 'lowpass', 450, 140, 0.8, t, 1.2, 0.5, 0.12);
    tone(d, 'sine', 55, 38, t, 1.1, 0.3, 0.1);
  },
  // стук костей: сухие щелчки вразнобой и клацанье челюсти
  rattle: (d, t) => {
    let tt = t;
    for (let k = 0; k < 7; k++) {
      const f = 1700 + Math.random() * 1400;
      modal(d, tt, [[f, 0.6, 0.04], [f * 1.6, 0.3, 0.03]], 0.4, 0.001);
      noiseHit(d, 'bandpass', f, f, 6, tt, 0.012, 0.3, 0.001);
      tt += 0.035 + Math.random() * 0.06;
    }
    modal(d, t + 0.12, [[680, 0.7, 0.05], [1100, 0.3, 0.04]], 0.3, 0.001);
  },
  // призрак: сквозняк-свист и два плывущих голоса с биениями, уходящие вниз
  wail: (d, t, v) => {
    const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 14; bp.connect(d);
    bp.frequency.setValueAtTime(900 + v * 150, t); bp.frequency.exponentialRampToValueAtTime(480, t + 1.6);
    noiseHit(bp, 'lowpass', 4000, 4000, 0.5, t, 1.9, 0.9, 0.35);
    for (const f of [440, 441.6]) { tone(d, 'sine', f * (0.98 + v * 0.04), f * 0.62, t, 1.7, 0.13, 0.35); tone(d, 'sine', f * 2.01, f * 1.3, t + 0.1, 1.3, 0.035, 0.3); }
  },
  // летучая мышь: три тихих писка
  squeak: (d, t, v) => { for (const k of [0, 0.07, 0.15]) tone(d, 'sine', 7000 - k * 9000 + v * 800, 4200 - k * 6000, t + k, 0.028, 0.2, 0.003); },
  // хлопок ладоней
  five: (d, t, v) => clapPlay(d, t, v),
  // золото/удача: колокольчик с обертонами
  chime: (d, t) => { for (const [f, k] of [[1318, 0], [1760, 0.09], [2637, 0.18]]) { modal(d, t + k, [[f, 1, 0.9], [f * 2.76, 0.25, 0.3]], 0.2, 0.004); } },
  // треск огня: короткие щелчки
  crackle: (d, t, v) => { for (let k = 0; k < 3; k++) noiseHit(d, 'bandpass', 1800 + Math.random() * 2500, 1200, 3, t + k * 0.05 + v * 0.03, 0.012, 0.3, 0.001); },
  // шипение (вода на огонь)
  hiss: (d, t) => noiseHit(d, 'highpass', 3500, 6000, 0.8, t, 0.9, 0.3, 0.15),
  // взмах
  whoosh: (d, t) => noiseHit(d, 'bandpass', 500, 2500, 1, t, 0.3, 0.4, 0.1),
};

function sfxAt(kind, wx, wy, vel = 1, delay = 0) {
  if (!Sfx.ctx || !Sfx.on || !SFX[kind]) return;
  const p = sfxPlace(wx, wy);
  if (!p || p.vol * vel < 0.04) return;
  const def = SFX_DEF[kind] || SFX_DEFAULT;
  const d = sfxVoice(kind, def, p, vel, delay);
  if (!d) return;
  const t = Sfx.ctx.currentTime + 0.012 + delay + Math.random() * 0.015;
  SFX[kind](d, t, Math.random());
}

// Звук жителя по анимации (центр клетки → мировые пиксели)
const ANIM_SFX = { build: 'build', chop: 'chop', mine: 'mine', dig: 'dig', reap: 'reap', hoppick: 'forage', forage: 'forage', smoke: 'smoke', faint: 'groan' };
function sfxUnit(u, kind, delay = 0) { if (!u.inside) sfxAt(ANIM_SFX[kind] || kind, u.x * TILE, u.y * TILE, 1, delay / Math.max(1, Game.speed)); }

// Возгласы по всплывающим надписям
const FLOAT_SFX = { 'Дзынь!': 'glass', 'А-а-а!': 'scream', 'Ой!': 'ouch', 'Хрясь!': 'chop', 'Га-га!': 'honk', 'У-ху!': 'hoot', 'Ай!': 'ouch', 'Ко-ко!': 'cluck', 'Бух!': 'thud', 'Золото!': 'chime' };
function sfxFloater(text, x, y) { if (FLOAT_SFX[text]) sfxAt(FLOAT_SFX[text], x * TILE, y * TILE); }

// ---------- Шаги ----------
// Шаги слышны у 4 ближайших к центру идущих жителей; шаг — каждые 4.4 единицы фазы ходьбы (две ноги на цикл)
const STEP_PHASE = 4.4;
function sfxSteps() {
  if (!R.canvas) return;
  const W = R.canvas.clientWidth, H = R.canvas.clientHeight, s = camScale();
  const cand = [];
  for (const u of Game.units) {
    if (u.inside || u.dead || !u.action || !u.action.walk) continue;
    const sx = (u.x * TILE - R.cam.x) * s, sy = (u.y * TILE - R.cam.y) * s;
    if (sx < 0 || sy < 0 || sx > W || sy > H) continue;
    cand.push([Math.hypot((sx - W / 2) / W, (sy - H / 2) / H), u]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < cand.length && i < 4; i++) {
    const u = cand[i][1], ph = Math.floor(u.walkPhase / STEP_PHASE), last = Sfx.steps.get(u);
    if (last === ph) continue;
    Sfx.steps.set(u, ph);
    if (last === undefined) continue;
    const tx = Math.floor(u.x), ty = Math.floor(u.y);
    const road = typeof inb === 'function' && inb(tx, ty) && World.road[idx(tx, ty)];
    const heavy = UNIT_TYPES[u.type] && UNIT_TYPES[u.type].animal ? 0.7 : (u.carry ? 1.1 : 1);
    sfxAt(road ? 'stepRoad' : 'step', u.x * TILE, u.y * TILE, heavy * (0.8 + Math.random() * 0.3));
  }
}

// ---------- Фон: сверчки, ветер, костёр ----------
// Непрерывные источники с медленно меняющейся громкостью; создаются один раз.
function sfxAmbInit() {
  if (Sfx.amb || !Sfx.ctx) return;
  AudioCore.keep = true;                 // эти источники живут вечно — сторож их не трогает
  try { sfxAmbBuild(); } finally { AudioCore.keep = false; }
}
function sfxAmbBuild() {
  const ctx = Sfx.ctx, A = Sfx.amb = {};
  const mkGain = () => { const g = ctx.createGain(); g.gain.value = 0; g.connect(AudioCore.amb); return g; };
  // сверчки: два стрекочущих тона, прерывистые, в разной фазе
  A.cricket = mkGain();
  for (const [f, rate, ph] of [[4100, 1.3, 0], [4650, 1.05, 0.5]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f;
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
    const trill = ctx.createOscillator(), tg = ctx.createGain(); trill.type = 'square'; trill.frequency.value = 26 + ph * 6; tg.gain.value = 0.5;
    const slow = ctx.createOscillator(), sg = ctx.createGain(); slow.type = 'sine'; slow.frequency.value = rate; sg.gain.value = 0.5;
    g.gain.value = 0;                     // = 0.5 (trill) + 0.5 (slow) → стрекот то есть, то нет
    trill.connect(tg); tg.connect(g.gain); slow.connect(sg); sg.connect(g.gain);
    o.connect(bp); bp.connect(g); g.connect(A.cricket);
    o.start(); trill.start(ph); slow.start(ph);
  }
  // ветер: тёмный шум с гуляющим срезом
  A.wind = mkGain();
  { const src = ctx.createBufferSource(); src.buffer = Sfx.noise; src.loop = true; src.playbackRate.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.8;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency);
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.21; lg2.gain.value = 0.25; lfo2.connect(lg2);
    const am = ctx.createGain(); am.gain.value = 0.6; lg2.connect(am.gain);
    src.connect(lp); lp.connect(am); am.connect(A.wind); src.start(); lfo.start(); lfo2.start(); }
  // костёр: низкий гул пламени с «дыханием»; треск добавляется отдельными щелчками
  A.fire = mkGain();
  { const src = ctx.createBufferSource(); src.buffer = Sfx.noise; src.loop = true; src.playbackRate.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.6;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.type = 'sine'; lfo.frequency.value = 6.5; lg.gain.value = 0.3; lfo.connect(lg);
    const am = ctx.createGain(); am.gain.value = 0.7; lg.connect(am.gain);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(lp); lp.connect(am);
    if (pan) { am.connect(pan); pan.connect(A.fire); A.firePan = pan; } else am.connect(A.fire);
    src.start(); lfo.start(); }
}

// Ближайший к центру экрана огонь: большой костёр за работой, пожары, горящие жители
function sfxNearestFire() {
  let best = null;
  const see = (wx, wy, k) => { const p = sfxPlace(wx, wy); if (p && (!best || p.vol * k > best.vol)) best = { vol: p.vol * k, pan: p.pan, wx, wy }; };
  for (const b of Game.buildings) if (b.def && b.def.burn && b.state === 'done' && b.working) see((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, 1);
  if (typeof WX !== 'undefined' && WX.fires) for (const f of WX.fires) see(f.x * TILE, f.y * TILE, 0.6);
  for (const u of Game.units) if (u.burn && u.burn.stage && u.burn.stage !== 'out' && !u.inside) see(u.x * TILE, u.y * TILE, 0.5);
  return best;
}

function sfxAmbTick(dt) {
  sfxAmbInit();
  const A = Sfx.amb; if (!A) return;
  const ctx = Sfx.ctx, t = ctx.currentTime;
  const night = typeof nightAmt === 'function' ? nightAmt() : 0;
  const rain = typeof WX !== 'undefined' ? WX.k || 0 : 0;
  const zoom = Math.min(1.1, Math.max(0.6, 0.45 + R.cam.z * 0.22));
  // сверчки — ночью, стихают под дождём и когда камера высоко
  A.cricket.gain.setTargetAtTime(0.028 * Math.max(0, night - 0.25) * (1 - 0.85 * rain) * zoom, t, 1.2);
  // ветер — лёгкий днём, сильнее ночью и в дождь
  A.wind.gain.setTargetAtTime(0.05 + 0.05 * night + 0.1 * rain, t, 2);
  // костёр
  const f = sfxNearestFire();
  A.fire.gain.setTargetAtTime(f ? 0.45 * f.vol : 0, t, 0.5);
  if (f && A.firePan) A.firePan.pan.setTargetAtTime(f.pan, t, 0.5);
  Sfx.fireT -= dt;
  if (f && Sfx.fireT <= 0) { Sfx.fireT = 0.12 + Math.random() * 0.35; sfxAt('crackle', f.wx, f.wy, 0.5 + Math.random() * 0.6); }
}

// ---------- Периодика ----------
// Каждый шаг симуляции: шаги, фон; раз в ~1.6 с — храп спящих и икота пьяных
function sfxTick(dt) {
  if (!Sfx.ctx || !Sfx.on || Game.paused) return;
  Sfx.stepT += dt;
  if (Sfx.stepT >= 0.05) { Sfx.stepT = 0; sfxSteps(); sfxAmbTick(0.05); }
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
  if (Sfx.ctx) { audioSetBus('sfx', on); audioSetBus('amb', on); audioSetBus('ui', on); }
}

function initSfx() {
  try { Sfx.on = localStorage.getItem('feod.sfx') !== '0'; } catch (e) { Sfx.on = true; }
  audioKickOnGesture(sfxInit);
  const btn = document.getElementById('sfx-btn');
  if (btn) {
    const sync = () => { btn.classList.toggle('active', Sfx.on); btn.textContent = Sfx.on ? '🔊' : '🔈'; btn.title = Sfx.on ? 'Звуки: вкл' : 'Звуки: выкл'; };
    btn.onclick = (e) => { e.stopPropagation(); sfxInit(); setSfx(!Sfx.on); sync(); };
    sync();
  }
}

// ---------- Хлопки ----------
// Хлопок ладоней — не тон, а короткий шумовой всплеск 5–25 мс через резонанс «кулака» и глухой «пок» ладони.
// Всё рендерится в буфер на JS: один хлопок — 6 вариантов формы (сухой, гулкий, двойной «флэм», шлепок),
// толпа — много мелких хлопков с разной громкостью, тембром и панорамой, плотность растёт и спадает.
// В граф уходит один источник, а не сотни узлов — нечему залипнуть.
const Clap = { singles: [], crowd: new Map(), busy: 0 };

// опции хлопка: f — центр шума, q — острота, dec — спад (с), body — доля глухого «пока», flam — повтор через мс
function clapInto(L, R, sr, at, amp, pan, o) {
  const a = (pan + 1) * Math.PI / 4, gl = amp * Math.cos(a), gr = amp * Math.sin(a);
  for (let h = 0; h < 1 + (o.flam ? 1 : 0); h++) {
    const st = Math.floor((at + h * (o.flam || 0)) * sr), hv = h ? 0.6 : 1;
    const n = Math.floor(o.dec * sr * 6), w = 2 * Math.sin(Math.PI * Math.min(o.f, sr * 0.2) / sr), att = Math.max(2, 0.0007 * sr);
    let low = 0, band = 0;
    for (let i = 0; i < n; i++) {
      const j = st + i; if (j >= L.length) break;
      const hi = (Math.random() * 2 - 1) - low - band / o.q; band += w * hi; low += w * band;
      const env = Math.exp(-i / (o.dec * sr)) * Math.min(1, i / att);
      let s = band * env;
      if (o.body && i < sr * 0.03) s += o.body * Math.sin(2 * Math.PI * o.bf * i / sr) * Math.exp(-i / (0.006 * sr));
      L[j] += s * gl * hv; R[j] += s * gr * hv;
    }
  }
}
function clapNormalize(L, R, peak) {
  let m = 0.0001; for (let i = 0; i < L.length; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
  const k = peak / m; for (let i = 0; i < L.length; i++) { L[i] *= k; R[i] *= k; }
}
const clapRnd = (a, b) => a + Math.random() * (b - a);

function clapSingles(ctx) {
  if (Clap.singles.length) return Clap.singles;
  const sr = ctx.sampleRate, kinds = [
    { f: 2300, q: 1.6, dec: 0.005, body: 0.15, bf: 420 },                    // сухой, звонкий
    { f: 1500, q: 1.1, dec: 0.009, body: 0.45, bf: 330 },                    // гулкий, «чашечкой»
    { f: 1900, q: 1.3, dec: 0.006, body: 0.25, bf: 380, flam: 0.011 },       // чуть несинхронный
    { f: 2700, q: 2.0, dec: 0.004, body: 0.05, bf: 500 },                    // шлепок «пять» по ладони
    { f: 1200, q: 0.9, dec: 0.012, body: 0.5, bf: 280 },                     // мягкий
    { f: 2000, q: 1.4, dec: 0.007, body: 0.3, bf: 400, flam: 0.016 },
  ];
  for (const o of kinds) {
    const b = ctx.createBuffer(2, Math.floor(sr * 0.18), sr), L = b.getChannelData(0), R = b.getChannelData(1);
    clapInto(L, R, sr, 0.004, 1, 0, o); clapNormalize(L, R, 0.9);
    Clap.singles.push(b);
  }
  return Clap.singles;
}
function clapPlay(d, t, v) {
  const ctx = Sfx.ctx, bufs = clapSingles(ctx), src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
  src.playbackRate.value = 0.92 + v * 0.16;
  g.gain.value = 0.9;
  src.connect(g); g.connect(d); src.start(t);
}

// Толпа: dur секунд, плотность — подъём 0.4 с, плато, затухание; amount — сколько людей
function clapCrowdBuffer(ctx, amount) {
  const key = Math.round(amount * 3), cached = Clap.crowd.get(key);
  if (cached && cached.length >= 3 && Math.random() < 0.7) return cached[(Math.random() * cached.length) | 0];
  const sr = ctx.sampleRate, dur = 2.4 + 2.2 * amount, b = ctx.createBuffer(2, Math.floor(sr * dur), sr), L = b.getChannelData(0), R = b.getChannelData(1);
  const hold = dur * 0.5, tail = dur * 0.2, n = Math.round(60 + 190 * amount);
  for (let k = 0, tries = 0; k < n && tries < n * 30; tries++) {
    const t = Math.random() * (dur - 0.1);
    const dens = Math.min(1, t / 0.45) * (t < hold ? 1 : Math.exp(-(t - hold) / tail)) * (0.8 + 0.2 * Math.sin(t * 9));
    if (Math.random() > dens) continue;
    k++;
    const near = Math.pow(Math.random(), 2.2);                                // немного громких «рядом», много тихих «вдали»
    clapInto(L, R, sr, t, 0.12 + 0.88 * near, clapRnd(-0.9, 0.9), {
      f: clapRnd(1000, 3000) + near * 300, q: clapRnd(0.8, 2.2), dec: clapRnd(0.004, 0.011),
      body: near * 0.35, bf: clapRnd(280, 480), flam: Math.random() < 0.4 ? clapRnd(0.006, 0.016) : 0,
    });
  }
  clapNormalize(L, R, 0.85);
  const list = cached || []; list.push(b); Clap.crowd.set(key, list);
  return b;
}

// Аплодисменты: толпа мелких хлопков и пара довольных возгласов; музыка чуть отходит
function sfxApplause(amount = 1) {
  if (!Sfx.ctx || !Sfx.on || !Sfx.out || Sfx.ctx.state !== 'running' || document.hidden) return;
  const ctx = Sfx.ctx, t0 = ctx.currentTime + 0.03;
  if (t0 < Clap.busy) return;                                                 // уже аплодируют — не наслаиваем
  const buf = clapCrowdBuffer(ctx, Math.max(0.2, Math.min(1, amount)));
  Clap.busy = t0 + buf.duration * 0.5;
  const src = ctx.createBufferSource(), g = ctx.createGain(), out = ctx.createGain();
  src.buffer = buf; src.playbackRate.value = 0.96 + Math.random() * 0.08;
  const end = t0 + buf.duration / src.playbackRate.value;
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.55 + 0.3 * amount, t0 + 0.05);
  g.gain.setValueAtTime(0.55 + 0.3 * amount, end - 0.3); g.gain.linearRampToValueAtTime(0.0001, end - 0.02);
  out.gain.value = 1;
  src.connect(g); g.connect(out); out.connect(Sfx.out);
  if (Sfx.verb) { const wg = ctx.createGain(); wg.gain.value = 0.3; out.connect(wg); wg.connect(Sfx.verb); }
  src.start(t0); src.stop(end);
  for (let k = 0; k < 2; k++) gnomeVoice(out, t0 + 0.5 + k * 0.7 + Math.random() * 0.4, [[300 + k * 60, 480, 0.1], [480, 430, 0.18]], 0.1, 1050);
  audioDuck(0.3 * amount, buf.duration * 0.7);
}
