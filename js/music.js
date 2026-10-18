'use strict';
// ---------- Аудио-ядро ----------
// Один общий AudioContext на всю игру. Иерархия шин:
//   Мастер → лимитер → наушники
//     ├─ Музыка (с «приседанием» под гром и крики)
//     ├─ Звуки мира (sfx.js: пространственные, с компрессором)
//     ├─ Фон (дождь, ветер, сверчки, костёр)
//     └─ Интерфейс (щелчки кнопок, подсказки)
// Переключатели музыки и звуков управляют своими шинами; когда обе выключены — контекст засыпает.

const AudioCore = { ctx: null, master: null, limiter: null, music: null, musicDuck: null, sfx: null, amb: null, ui: null, noise: null, air: null,
  an: null, srcs: new Set(), keep: false, hiddenAt: 0, rebuilds: 0, kills: 0, dog: null, wd: { wall: 0, ct: 0, stall: 0, hot: 0, killT: [] } };

function audioCoreInit() {
  if (AudioCore.ctx) return AudioCore.ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ctx;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
  AudioCore.ctx = ctx;
  AudioCore.srcs = new Set();
  // учёт источников звука: чтобы знать, сколько их живо, и гасить залипшие (сторож ниже)
  const mkOsc = ctx.createOscillator.bind(ctx), mkSrc = ctx.createBufferSource.bind(ctx);
  const track = (n) => { const r = { n, t0: ctx.currentTime, keep: AudioCore.keep }; AudioCore.srcs.add(r); n.onended = () => AudioCore.srcs.delete(r); return n; };
  ctx.createOscillator = () => track(mkOsc());
  ctx.createBufferSource = () => track(mkSrc());
  const master = AudioCore.master = ctx.createGain(); master.gain.value = 0.8;
  // лимитер: быстрый и жёсткий, ловит только случайные пики — обычная динамика его не касается
  const lim = AudioCore.limiter = ctx.createDynamicsCompressor();
  lim.threshold.value = -5; lim.knee.value = 3; lim.ratio.value = 18; lim.attack.value = 0.0015; lim.release.value = 0.14;
  master.connect(lim); lim.connect(ctx.destination);
  AudioCore.an = ctx.createAnalyser(); AudioCore.an.fftSize = 1024; lim.connect(AudioCore.an);   // уровень на выходе — для сторожа
  const bus = (g, to = master) => { const n = ctx.createGain(); n.gain.value = g; n.connect(to); return n; };
  AudioCore.musicDuck = bus(1);
  AudioCore.music = bus(1, AudioCore.musicDuck);
  AudioCore.sfx = bus(1); AudioCore.amb = bus(1); AudioCore.ui = bus(1);
  // общий белый шум (2 с) — источник для всего шумового синтеза
  const nl = ctx.sampleRate * 2;
  AudioCore.noise = ctx.createBuffer(1, nl, ctx.sampleRate);
  const nd = AudioCore.noise.getChannelData(0);
  for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
  if (!AudioCore.dog) AudioCore.dog = setInterval(audioWatch, 1000);
  return ctx;
}

// ---------- Сон вкладки и сторож ----------
// Вкладка скрыта → контекст замирает, ничего нового не планируется; при возврате — продолжаем с чистого листа:
// недолгое скрытие — просто resume, долгое — звук пересоздаётся (никаких «лавин» запоздавших нот и висящих тонов).
function audioWanted() { return (typeof Music !== 'undefined' && Music.on) || (typeof Sfx !== 'undefined' && Sfx.on); }

function audioHide() {
  const ctx = AudioCore.ctx;
  if (!ctx || AudioCore.hiddenAt) return;
  AudioCore.hiddenAt = performance.now();
  if (typeof Sfx !== 'undefined') { Sfx.voices = []; Sfx.kindT.clear(); }
  try { ctx.suspend(); } catch (e) { /* уже закрыт */ }
}

function audioShow() {
  const ctx = AudioCore.ctx, was = AudioCore.hiddenAt;
  AudioCore.hiddenAt = 0;
  if (!ctx || !was) return;
  const wd = AudioCore.wd; wd.wall = 0; wd.stall = 0; wd.hot = 0;
  if (performance.now() - was > 45000 || ctx.state === 'closed') { audioRebuild('long-hidden'); return; }
  if (typeof Music !== 'undefined' && Music.ctx) Music.nextTime = ctx.currentTime + 0.15;
  if (audioWanted()) ctx.resume().catch(() => {});
}

// Пересоздать аудио-ядро целиком: старый контекст закрывается вместе со всеми узлами
function audioRebuild(why) {
  const old = AudioCore.ctx; if (!old) return;
  AudioCore.rebuilds++;
  if (window.console) console.warn('[audio] пересоздание ядра:', why);
  const wasMusic = typeof Music !== 'undefined' && Music.started, track = wasMusic ? Music.track : 0;
  if (typeof Music !== 'undefined') { clearInterval(Music.timer); Music.timer = null; Music.started = false; Music.ctx = null; }
  if (typeof Sfx !== 'undefined') { Sfx.ctx = null; Sfx.out = null; Sfx.verb = null; Sfx.amb = null; Sfx.voices = []; Sfx.kindT.clear(); Sfx.steps = new WeakMap(); }
  if (typeof WX !== 'undefined') WX.snd = null;
  try { AudioCore.master.gain.setValueAtTime(0, old.currentTime); } catch (e) { /* мёртвый контекст */ }
  AudioCore.ctx = null; AudioCore.srcs = new Set(); AudioCore.hiddenAt = 0;
  setTimeout(() => { try { old.close(); } catch (e) { /* уже закрыт */ } }, 150);
  const wd = AudioCore.wd; wd.wall = 0; wd.stall = 0; wd.hot = 0;
  const ctx = audioCoreInit(); if (!ctx) return;
  if (typeof sfxInit === 'function') { sfxInit(); audioSetBus('amb', Sfx.on); audioSetBus('ui', Sfx.on); }
  if (wasMusic && typeof startMusic === 'function') {
    startMusic();
    Music.track = track; Music.bar = 0;
    Music.bus.gain.cancelScheduledValues(0); Music.bus.gain.value = 0.62 * TRACKS[track].level;
  }
  // без жеста браузер может оставить новый контекст спящим — разбудим первым же касанием
  if (ctx.state !== 'running' && !document.hidden) audioKickOnGesture(() => { if (audioWanted() && AudioCore.ctx) AudioCore.ctx.resume(); });
}

// Сторож (раз в секунду): часы контекста, залипшие и лишние источники, NaN и перегруз на выходе
function audioWatch() {
  const ctx = AudioCore.ctx, wd = AudioCore.wd;
  if (!ctx) return;
  if (document.hidden) { wd.wall = 0; return; }
  if (ctx.state === 'closed') { audioRebuild('closed'); return; }
  if (ctx.state !== 'running') { wd.wall = 0; if (audioWanted() && !AudioCore.hiddenAt) ctx.resume().catch(() => {}); return; }
  const now = performance.now(), ct = ctx.currentTime;
  // часы контекста встали, а время идёт — устройство вывода отвалилось
  if (wd.wall && now - wd.wall > 700 && ct - wd.ct < 0.01) { if (++wd.stall >= 3) { audioRebuild('clock-stall'); return; } } else wd.stall = 0;
  wd.wall = now; wd.ct = ct;
  // залипшие разовые источники: ни один не живёт дольше 15 секунд
  let trans = 0;
  for (const r of AudioCore.srcs) {
    if (r.keep) continue;
    if (ct - r.t0 > 15) { try { r.n.stop(); } catch (e) { /* не запускался */ } AudioCore.srcs.delete(r); AudioCore.kills++; } else trans++;
  }
  // лавина узлов: гасим все разовые источники; если повторяется — пересоздаём ядро
  if (trans > 450) {
    for (const r of AudioCore.srcs) if (!r.keep) { try { r.n.stop(); } catch (e) { /* не запускался */ } AudioCore.srcs.delete(r); }
    AudioCore.kills++;
    wd.killT = wd.killT.filter(x => now - x < 30000); wd.killT.push(now);
    if (wd.killT.length >= 3) { wd.killT = []; audioRebuild('node-flood'); return; }
  }
  // выход: NaN навсегда ломает компрессоры, перегруз подряд — признак зациклившегося тона
  if (AudioCore.an) {
    const buf = wd.buf || (wd.buf = new Float32Array(AudioCore.an.fftSize));
    AudioCore.an.getFloatTimeDomainData(buf);
    let peak = 0, bad = false;
    for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (!isFinite(v)) { bad = true; break; } const a = Math.abs(v); if (a > peak) peak = a; }
    wd.peak = peak;
    if (bad) { audioRebuild('nan'); return; }
    wd.hot = peak > 0.97 ? wd.hot + 1 : 0;
    if (wd.hot >= 6) { wd.hot = 0; audioRebuild('overload'); return; }
  }
}

window.addEventListener('pagehide', audioHide);
window.addEventListener('pageshow', audioShow);
document.addEventListener('visibilitychange', () => { if (document.hidden) audioHide(); else audioShow(); });

// Шину включают/выключают плавно, без щелчка
function audioSetBus(name, on) {
  const b = AudioCore[name], ctx = AudioCore.ctx;
  if (!b || !ctx) return;
  const t = ctx.currentTime, g = b.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(on ? 1 : 0.0001, t + 0.12);
  audioMaybeSuspend();
}

// Когда и музыка, и звуки выключены — контекст спит и не тратит процессор
function audioMaybeSuspend() {
  const ctx = AudioCore.ctx;
  if (!ctx || document.hidden) return;
  const anyOn = (typeof Music !== 'undefined' && Music.on) || (typeof Sfx !== 'undefined' && Sfx.on);
  if (anyOn) { if (ctx.state !== 'running') ctx.resume(); }
  else if (ctx.state === 'running') setTimeout(() => { if (!((typeof Music !== 'undefined' && Music.on) || (typeof Sfx !== 'undefined' && Sfx.on))) ctx.suspend(); }, 200);
}

// «Приседание» музыки: под гром, крик, аплодисменты музыка на миг отходит назад
function audioDuck(depth = 0.5, hold = 0.6, delay = 0) {
  const ctx = AudioCore.ctx; if (!ctx || !AudioCore.musicDuck) return;
  const g = AudioCore.musicDuck.gain, t = ctx.currentTime + delay;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(1 - depth, t + 0.06);
  g.setValueAtTime(1 - depth, t + 0.06 + hold);
  g.linearRampToValueAtTime(1, t + 0.06 + hold + 1.2);
}

// Импульс реверберации: затухающий шум; decay больше — короче хвост
function makeImpulse(ctx, sec, decay = 2.6) {
  const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// Запуск по первому касанию (браузеры не дают звук без жеста)
function audioKickOnGesture(fn) {
  const kick = () => { fn(); window.removeEventListener('pointerdown', kick); window.removeEventListener('keydown', kick); window.removeEventListener('touchstart', kick); };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
  window.addEventListener('touchstart', kick);
}

// ---------- Музыка ----------
// Четыре собственных трека, синтез на лету, без файлов. Треки сменяют друг друга.
//  1) «Чаща»   — лесная, таинственная: ре дорийский, 3/4. Низкая флейта, арфа,
//                виолончельный бурдон, мягкий бойран «сердцебиением», колокольчики;
//                во второй половине — протяжные женские распевы.
//  2) «Долина» — светлый вальс в соль мажоре: флейта поёт напев, скрипка ведёт подголосок,
//                арфа и цимбалы перебирают, контрабас щиплет, бубен.
//  3) «Ярмарка» — живая джига 6/8 в ре мажоре: скрипка с форшлагами, свирель вторит
//                октавой выше, цимбалы на слабых долях, бойран и шейкер.
//  4) «Тревога» — ночной: бурдон с тритоном, редкие холодные удары, сердцебиение.
// Мелодии строятся из мотивов: короткие обороты повторяются и отвечают друг другу.

const Music = {
  ctx: null, master: null, bus: null, rev: null, hall: null, on: true, started: false,
  bar: 0, nextTime: 0, timer: null, buffers: new Map(), track: 0, songs: [], noise: null,
  mood: 'day', fightT: -1e9, dawnUntil: -1, waterT: -1e9, waterIn: 0, waterCool: 0, prevNight: null, moodT: 0,
};

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
function musicRng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- Треки ----------
// eighth — длительность восьмой (такт всегда 6 восьмых: 3/4 или 6/8); level — общий уровень трека

const TRACKS = [
  {
    name: 'Чаща', eighth: 0.31, swing: 0, bars: 32, voiceFrom: 16, seed: 71, lead: 'lowflute', level: 1,
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
    name: 'Долина', eighth: 0.22, swing: 0, bars: 48, voiceFrom: 32, seed: 233, lead: 'flute', level: 0.95,
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
    name: 'Ярмарка', eighth: 0.165, swing: 0.012, bars: 48, voiceFrom: 999, seed: 517, lead: 'fiddle', level: 0.82,
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
  {
    // «Тревога» — ночной трек: низкий бурдон с тритоном, редкие холодные удары, сердцебиение,
    // осторожная флейта и далёкий голос. Играет сам с наступлением ночи.
    name: 'Тревога', eighth: 0.4, swing: 0, bars: 24, voiceFrom: 4, seed: 911, lead: 'lowflute', level: 0.9,
    scale: [50, 51, 53, 55, 57, 58, 60, 62, 63, 65, 67, 69, 70, 72, 74, 75],
    chords: {
      Dm: { root: 38, tones: [50, 53, 57, 62, 65, 69] }, Eb: { root: 39, tones: [51, 55, 58, 63, 67, 70] },
      A: { root: 45, tones: [52, 57, 61, 64, 69, 73] }, Gm: { root: 43, tones: [50, 55, 58, 62, 67, 70] },
      Bb: { root: 46, tones: [53, 58, 62, 65, 70, 74] },
    },
    prog: ['Dm', 'Dm', 'Eb', 'Dm', 'A', 'Dm', 'Gm', 'A', 'Dm', 'Eb', 'Dm', 'A', 'Bb', 'A', 'Dm', 'A'],
    rhythms: [[6], [4, 2], [3, 3], [2, 4], [6], [5, 1]],
    range: [55, 73],
  },
  {
    // «За дом» — боевой: гномы отбиваются от нечисти. Марш в 6/8: тяжёлые барабаны, горн,
    // скрипка ведёт напев, наковальня отбивает ритм, мужской хор вступает со второй четверти.
    // Включается сам, пока идёт схватка, и уходит через несколько секунд после неё.
    name: 'За дом', special: 'battle', eighth: 0.17, swing: 0, bars: 32, voiceFrom: 8, seed: 1313, lead: 'fiddle', level: 1,
    scale: [57, 59, 60, 62, 64, 65, 67, 68, 69, 71, 72, 74, 76, 77, 79, 81],
    chords: {
      Am: { root: 45, tones: [57, 60, 64, 69, 72, 76, 81] }, G: { root: 43, tones: [55, 59, 62, 67, 71, 74, 79] },
      F: { root: 41, tones: [53, 57, 60, 65, 69, 72, 77] }, E: { root: 40, tones: [52, 56, 59, 64, 68, 71, 76] },
      Dm: { root: 38, tones: [50, 53, 57, 62, 65, 69, 74] },
    },
    prog: ['Am', 'Am', 'G', 'F', 'Am', 'Am', 'E', 'E', 'Dm', 'Dm', 'Am', 'Am', 'F', 'G', 'E', 'Am'],
    rhythms: [[1, 1, 1, 1, 1, 1], [2, 1, 2, 1], [3, 3], [1, 1, 2, 2], [2, 2, 2], [3, 1, 1, 1]],
    range: [57, 79],
  },
  {
    // «Рассвет» — звучит один раз, когда уходит туман: арфа поднимается вверх, виолончель дышит,
    // тихий горн зовёт, флейта и голоса встречают солнце.
    name: 'Рассвет', special: 'dawn', eighth: 0.36, swing: 0, bars: 24, voiceFrom: 6, seed: 77, lead: 'flute', level: 0.85,
    scale: [55, 57, 59, 60, 62, 64, 66, 67, 69, 71, 72, 74, 76, 78, 79, 81, 83],
    chords: {
      G: { root: 43, tones: [55, 59, 62, 67, 71, 74, 79] }, C: { root: 36, tones: [55, 60, 64, 67, 72, 76, 79] },
      D: { root: 38, tones: [54, 57, 62, 66, 69, 74, 78] }, Em: { root: 40, tones: [55, 59, 64, 67, 71, 76, 79] },
      Am: { root: 45, tones: [57, 60, 64, 69, 72, 76] },
    },
    prog: ['G', 'G', 'C', 'D', 'Em', 'C', 'G', 'D', 'C', 'G', 'Am', 'D', 'G', 'Em', 'C', 'G'],
    rhythms: [[6], [3, 3], [4, 2], [2, 2, 2], [2, 4], [3, 1, 2]],
    range: [62, 83],
  },
  {
    // «У воды» — когда камера у реки или озера: ре мажор, журчащие арфовые переборы,
    // калимба, капли, шелест волны и тихая свирель.
    name: 'У воды', special: 'water', eighth: 0.3, swing: 0, bars: 24, voiceFrom: 999, seed: 404, lead: 'kalimba', level: 0.8,
    scale: [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86],
    chords: {
      D: { root: 38, tones: [50, 54, 57, 62, 66, 69, 73, 78] }, Bm: { root: 47, tones: [54, 59, 62, 66, 71, 74, 78] },
      G: { root: 43, tones: [55, 59, 62, 67, 71, 74, 79] }, A: { root: 45, tones: [57, 61, 64, 69, 73, 76, 81] },
    },
    prog: ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'A', 'Bm', 'G', 'D', 'A', 'G', 'D', 'A', 'D'],
    rhythms: [[3, 3], [2, 2, 2], [4, 2], [2, 4], [6], [1, 1, 2, 2]],
    range: [62, 86],
  },
  {
    // Три эльфийских трека — светлая деревня на опушке: воздушная флейта, арфа, женский хор, струнный пад, колокольчики.
    // «Лунный лес» — ми дорийский, тянущийся хор и тихая лунная флейта.
    name: 'Лунный лес', eighth: 0.34, swing: 0, bars: 32, voiceFrom: 8, seed: 2101, lead: 'lowflute', level: 1.05,
    scale: [52, 54, 55, 57, 59, 61, 62, 64, 66, 67, 69, 71, 73, 74, 76, 78],
    chords: {
      Em: { root: 40, tones: [52, 55, 59, 64, 67, 71, 76] }, D: { root: 38, tones: [50, 54, 57, 62, 66, 69, 74] },
      A: { root: 45, tones: [52, 57, 61, 64, 69, 73, 76] }, G: { root: 43, tones: [55, 59, 62, 67, 71, 74, 79] },
      Bm: { root: 47, tones: [54, 59, 62, 66, 71, 74, 78] },
    },
    prog: ['Em', 'Em', 'D', 'A', 'Em', 'G', 'D', 'A', 'Bm', 'G', 'D', 'Em', 'A', 'D', 'G', 'Em'],
    rhythms: [[6], [4, 2], [3, 3], [2, 2, 2], [2, 4], [3, 1, 2]],
    range: [59, 78],
  },
  {
    // «Песнь листвы» — соль лидийский, лёгкий 6/8: бегущая арфа, свирель и калимба, одинокий сопрано.
    name: 'Песнь листвы', eighth: 0.26, swing: 0, bars: 32, voiceFrom: 16, seed: 2202, lead: 'flute', level: 0.9,
    scale: [55, 57, 59, 61, 62, 64, 66, 67, 69, 71, 73, 74, 76, 78, 79, 81],
    chords: {
      G: { root: 43, tones: [55, 59, 62, 67, 71, 74, 79] }, D: { root: 38, tones: [54, 57, 62, 66, 69, 74, 78] },
      Em: { root: 40, tones: [55, 59, 64, 67, 71, 76, 79] }, A: { root: 45, tones: [57, 61, 64, 69, 73, 76, 81] },
      Bm: { root: 47, tones: [59, 62, 66, 71, 74, 78] },
    },
    prog: ['G', 'D', 'Em', 'A', 'G', 'D', 'Bm', 'A', 'Em', 'G', 'D', 'A', 'G', 'Bm', 'A', 'G'],
    rhythms: [[2, 1, 1, 2], [3, 1, 2], [2, 2, 2], [1, 1, 2, 2], [4, 2], [2, 4]],
    range: [64, 83],
  },
  {
    // «Серебряные чертоги» — ре дорийский, неспешный торжественный ход: хор в три голоса, струнный пад, далёкие колокола.
    name: 'Серебряные чертоги', eighth: 0.42, swing: 0, bars: 24, voiceFrom: 2, seed: 2303, lead: 'flute', level: 1.3,
    scale: [50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77],
    chords: {
      Dm: { root: 38, tones: [50, 53, 57, 62, 65, 69, 74] }, C: { root: 36, tones: [48, 52, 55, 60, 64, 67, 72] },
      G: { root: 43, tones: [50, 55, 59, 62, 67, 71, 74] }, Am: { root: 45, tones: [52, 57, 60, 64, 69, 72, 76] },
      F: { root: 41, tones: [53, 57, 60, 65, 69, 72, 77] },
    },
    prog: ['Dm', 'C', 'Dm', 'G', 'Am', 'G', 'F', 'C', 'Dm', 'C', 'F', 'G', 'Am', 'G', 'Dm', 'Dm'],
    rhythms: [[6], [4, 2], [3, 3], [2, 4], [6], [3, 3]],
    range: [57, 77],
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
  // короткая атака вместо мгновенной — струна без щелчка
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
  src.connect(f); f.connect(g);
  src.start(t); src.stop(t + len + 0.05);
  return g;
}

const harp = (m, t, v = 0.35) => out(pluckNote(m, t, v, 'harp', 3000, 2.8), 1, 0.35);
const bassPluck = (m, t, v = 0.5) => out(pluckNote(m, t, v, 'bass', 700, 1.2), 1, 0.08);
// цимбалы: две слегка расстроенные струны — тот самый звонкий «дребезг»
function dulcimer(m, t, v = 0.22) {
  out(pluckNote(m, t, v, 'dulc', 4600, 2.2), 1, 0.3);
  const s2 = pluckNote(m + 0.08, t + 0.004, v * 0.6, 'dulc', 4600, 2);
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
  g2.gain.value = low ? 0.06 : wh ? 0.16 : 0.12;
  const att = low ? 0.1 : 0.035;
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
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = low ? 1800 : wh ? 5200 : 4000;
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp);
  out(lp, 1, low ? 0 : 0.3, low ? 0.6 : 0.15);
  const end = t + dur + 0.3;
  for (const n of [o1, o2, lfo]) { n.start(t); n.stop(end); }
  nb.start(t, Math.random()); nb.stop(end);
}

// Скрипка: две пилы с отстройкой, «корпус» резонансами, смычок шумом в атаке, позднее вибрато.
// Верх срезан мягче, чем раньше, — чтобы не резала ухо на долгих нотах.
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
  const body2 = ctx.createBiquadFilter(); body2.type = 'peaking'; body2.frequency.value = 2600; body2.Q.value = 1.5; body2.gain.value = 4;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.4;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(vel, t + 0.045);
  env.gain.setValueAtTime(vel * 0.9, t + dur * 0.8);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
  mix.connect(body1); body1.connect(body2); body2.connect(lp); lp.connect(env);
  out(env, 1, 0.35, 0.1);
  const nb = ctx.createBufferSource(), nbf = ctx.createBiquadFilter(), ng = ctx.createGain();
  nb.buffer = Music.noise; nbf.type = 'bandpass'; nbf.frequency.value = 2800; nbf.Q.value = 0.8;
  ng.gain.setValueAtTime(vel * 0.2, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
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
  for (const [mul, v, len] of [[1, 1, 1.4], [2.76, 0.35, 0.5], [5.4, 0.1, 0.25]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz * mul;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); out(g, 1, 0.5, 0.3);
    o.start(t); o.stop(t + len + 0.05);
  }
}

// Женский голос: две пилы через форманты гласной, вибрато, долгий отзвук
const VOWELS = { e: [[500, 1, 7], [1750, 0.4, 9], [2600, 0.1, 11]], i: [[300, 1, 7], [2300, 0.45, 10], [3000, 0.12, 12]], o:[[450, 1, 6], [800, 0.4, 8], [2800, 0.07, 10]], a:[[800, 1, 7], [1150, 0.5, 9], [2900, 0.22, 12]], u: [[350, 1, 6], [650, 0.35, 8], [2700, 0.08, 10]] };
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
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
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
  nb.buffer = Music.noise; f.type = 'bandpass'; f.frequency.value = 6500; f.Q.value = 1.2;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  nb.connect(f); f.connect(g); out(g);
  nb.start(t, Math.random()); nb.stop(t + 0.08);
}

function tambourine(t, vel) {
  const ctx = Music.ctx, nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Music.noise; f.type = 'highpass'; f.frequency.value = 6000;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  nb.connect(f); f.connect(g); out(g, 1, 0.1);
  nb.start(t, Math.random()); nb.stop(t + 0.15);
}

// ---------- Новые инструменты ----------

// Гномий горн: две пилы с отстройкой, фильтр раскрывается к середине ноты — «медный» набор силы
function mHorn(midi, t, dur, vel = 0.07) {
  const ctx = Music.ctx, hz = midiHz(midi), env = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(380, t); lp.frequency.exponentialRampToValueAtTime(1500, t + Math.min(0.35, dur * 0.6));
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + 0.09);
  env.gain.setValueAtTime(vel * 0.9, t + dur * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  lp.connect(env); out(env, 1, 0.25, 0.5);
  const end = t + dur + 0.3, lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 5; lg.gain.value = hz * 0.004; lfo.connect(lg);
  for (const det of [-6, 6]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = det;
    lg.connect(o.frequency); o.connect(lp); o.start(t); o.stop(end);
  }
  lfo.start(t); lfo.stop(end);
}

// Боевой барабан: низкий гулкий удар с хлопком кожи
function warDrum(t, vel = 0.4, pitch = 64) {
  const ctx = Music.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(pitch * 2, t); o.frequency.exponentialRampToValueAtTime(pitch * 0.62, t + 0.22);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g); out(g, 1, 0.1, 0.7); o.start(t); o.stop(t + 0.55);
  const nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
  nb.buffer = Music.noise; f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.7;
  ng.gain.setValueAtTime(vel * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  nb.connect(f); f.connect(ng); out(ng, 1, 0.1); nb.start(t, Math.random()); nb.stop(t + 0.09);
}

// Наковальня: звонкий удар молота по железу — несколько негармоничных обертонов
function mAnvil(t, vel = 0.07, hz = 1180) {
  const ctx = Music.ctx;
  for (const [mul, v, len] of [[1, 1, 0.5], [2.4, 0.5, 0.3], [4.1, 0.3, 0.2], [6.3, 0.15, 0.12]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz * mul;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * v, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); out(g, 1, 0.3, 0.3); o.start(t); o.stop(t + len + 0.03);
  }
  const nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
  nb.buffer = Music.noise; f.type = 'highpass'; f.frequency.value = 3500;
  ng.gain.setValueAtTime(vel * 0.6, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  nb.connect(f); f.connect(ng); out(ng); nb.start(t, Math.random()); nb.stop(t + 0.04);
}

// Калимба: мягкий деревянный язычок с коротким звонким обертоном
function kalimba(midi, t, vel = 0.1) {
  const ctx = Music.ctx, hz = midiHz(midi);
  for (const [mul, v, len] of [[1, 1, 1.1], [5.4, 0.25, 0.14], [2, 0.18, 0.5]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz * mul;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); out(g, 1, 0.4, 0.3); o.start(t); o.stop(t + len + 0.03);
  }
}

// Капля: короткий всплеск с подъёмом тона и долгим отзвуком
function droplet(t, vel = 0.05) {
  const ctx = Music.ctx, o = ctx.createOscillator(), g = ctx.createGain(), f = 1400 + Math.random() * 1600;
  o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.07);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g); out(g, 0.7, 0.8, 0.8); o.start(t); o.stop(t + 0.2);
}

// Плеск волны: шум, который накатывает и откатывает
function mWave(t, len, vel = 0.03) {
  const ctx = Music.ctx, nb = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  nb.buffer = Music.noise; f.type = 'lowpass'; f.Q.value = 0.6;
  f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1100, t + len * 0.45); f.frequency.linearRampToValueAtTime(260, t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + len * 0.45); g.gain.linearRampToValueAtTime(0.0001, t + len);
  nb.connect(f); f.connect(g); out(g, 1, 0.2, 0.5); nb.start(t, Math.random()); nb.stop(t + len + 0.05);
}

// Хор: несколько женских голосов в унисон-аккорде, вступают не разом — получается живое «облако»
function choir(midis, t, dur, vel = 0.045, vowel = 'a') {
  midis.forEach((m, k) => voice(m, t + k * 0.12, dur - k * 0.12, vel, vowel));
}

// Струнный пад: светлые пилы, мягкий фильтр, медленное дыхание — ложится под хор
function strPad(midis, t, dur, vel = 0.03) {
  const ctx = Music.ctx, env = ctx.createGain(), lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(2400, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(1000, t + dur); lp.Q.value = 0.4;
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(vel, t + Math.min(1.6, dur * 0.4));
  env.gain.setValueAtTime(vel, t + dur * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
  lp.connect(env); out(env, 1, 0.3, 0.7);
  const end = t + dur + 0.9;
  for (const m of midis) for (const det of [-7, 7]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midiHz(m); o.detune.value = det;
    o.connect(lp); o.start(t); o.stop(end);
  }
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
  } else if (tr.name === 'Тревога') {
    // бурдон: ре и соль-диез (тритон) долго тянутся; сердце бьётся «тук-тук … тук-тук»
    if (bar % 3 === 0) { cello([38, 44], t, len * 3, 0.05); }
    bodhran(t, 0.2, 70); bodhran(at(1), 0.13, 66); if (bar % 2) { bodhran(at(3), 0.16, 70); bodhran(at(4), 0.1, 66); }
    bassPluck(ch.root, t, 0.3);
    // редкие холодные удары в высоком регистре, малая секунда друг над другом
    if (bar % 2 === 0) { const hi = ch.tones[ch.tones.length - 1]; glock(hi, at(2), 0.06); glock(hi + 1, at(2) + 0.03, 0.035); }
    if (bar % 4 === 3) dulcimer(up[1] + 12, at(5), 0.1);
    // осторожная флейта: только первые звуки каждого такта, иногда нет совсем
    if (bar % 4 !== 2) { let pos = 0; for (const [m, l] of notes.slice(0, 2)) { flute(m, at(pos), l * E * 0.95, 0.11, 'lowflute'); pos += l; } }
    if (bar % 4 === 0 && voiceNow) { const vt = ch.tones.filter(m => m >= 62 && m <= 72); if (vt[0]) voice(vt[(bar / 4) % vt.length], at(1), len * 2, 0.05, 'u'); }
    for (let k = 1; k < 6; k += 2) shaker(at(k), 0.009);
  } else if (tr.name === 'Лунный лес') {
    // тихий пульс арфы, хор тянется через такт, флейта поёт редко, звёздочки-колокольчики
    [up[0], up[1], up[2], up[3] || up[1] + 12, up[2], up[1]].forEach((m, k) => harp(m + 12, at(k), k === 0 ? 0.16 : 0.1));
    if (bar % 2 === 0) bassPluck(ch.root, t, 0.26);
    if (bar % 4 === 0) strPad([up[0], up[2], up[4] || up[2] + 12], t, len * 4, 0.028);
    if (voiceNow && bar % 2 === 0) choir([up[1], up[2], up[3] || up[1] + 12].map(m => m + 12), t, len * 2 - E, 0.04, bar % 4 === 0 ? 'u' : 'a');
    if (!(voiceNow && bar % 8 < 3)) { let pos = 0; for (const [m, l] of notes) { flute(m, at(pos), l * E * 0.95, pos === 0 ? 0.15 : 0.11, 'lowflute'); pos += l; } }
    if (bar % 2 === 1) glock(ch.tones[ch.tones.length - 1 - (bar % 3)], at(2 + (bar % 3)), 0.04);
    if (phraseEnd) [0, 2, 4].forEach((k, j) => glock(ch.tones[ch.tones.length - 1 - j], at(k), 0.05));
  } else if (tr.name === 'Песнь листвы') {
    // бегущая арфа в 6/8, калимба вторит, свирель и скрипка — только на повторе, одинокий сопрано
    [0, 1, 2, 1, 2, 3].forEach((i, k) => harp(up[i % up.length] + 12, at(k), k % 3 === 0 ? 0.15 : 0.09));
    bassPluck(ch.root, t, 0.3); if (bar % 2) bassPluck(ch.root + 7, at(3), 0.2);
    let pos = 0;
    for (const [m, l] of notes) {
      flute(m, at(pos), l * E * 0.95, pos === 0 ? 0.15 : 0.11);
      if (bar % 2 === 1) kalimba(m + 12, at(pos), 0.05);
      if (bar >= 8) flute(m + 12, at(pos), l * E * 0.85, 0.04, 'whistle');
      pos += l;
    }
    if (bar % 4 === 0) strPad([up[0], up[2]], t, len * 4, 0.022);
    if (voiceNow && bar % 2 === 1) { const vt = ch.tones.filter(m => m >= 71 && m <= 83); if (vt[0]) voice(vt[(bar >> 1) % vt.length], at(1), len * 2 - E * 2, 0.045, 'e'); }
    tambourine(t, 0.012); tambourine(at(3), 0.01);
    if (phraseEnd) glock(ch.tones[ch.tones.length - 1], at(2), 0.05);
  } else if (tr.name === 'Серебряные чертоги') {
    // торжественный ход: хор из трёх голосов на каждом такте, пад, редкий горн и колокола
    const vow = ['a', 'o', 'u', 'a'][bar % 4];
    if (voiceNow) choir([ch.tones[1], ch.tones[2], ch.tones[3]].map(m => m + 12 > 79 ? m : m + 12), t, len - E * 0.5, 0.042, vow);
    if (bar % 2 === 0) strPad([ch.tones[0], ch.tones[2], ch.tones[4]], t, len * 2, 0.03);
    if (bar % 8 === 0) mHorn(ch.root + 24, t, len * 2 - E, 0.035);
    harp(up[0] + 12, t, 0.13); harp(up[2] + 12, at(3), 0.09);
    if (bar % 2) glock(ch.tones[ch.tones.length - 1], at(2), 0.045);
    if (bar % 4 === 0) bodhran(t, 0.09, 70);
    if (bar >= 4) { let pos = 0; for (const [m, l] of notes) { flute(m, at(pos), l * E * 0.95, pos === 0 ? 0.13 : 0.1, bar % 8 < 4 ? 'flute' : 'whistle'); pos += l; } }
    if (phraseEnd) voice(ch.tones[ch.tones.length - 1] + (ch.tones[ch.tones.length - 1] > 70 ? 0 : 12), at(1), len - E, 0.05, 'i');
  } else if (tr.name === 'За дом') {
    // марш: барабан на раз и четыре, дробь-подхват на слабых, бас шагает, наковальня на «и» каждого второго такта
    warDrum(t, 0.4, 62); warDrum(at(3), 0.3, 70);
    for (const k of [1, 2, 4, 5]) bodhran(at(k), 0.07, 130);
    if (bar % 4 === 3) for (let k = 3; k < 6; k++) warDrum(at(k) + E * 0.5, 0.12, 90);               // подхват-дробь перед сменой
    bassPluck(ch.root, t, 0.55); bassPluck(ch.root + 7, at(2), 0.36); bassPluck(ch.root, at(3), 0.5); bassPluck(ch.root + 7, at(5), 0.34);
    if (bar % 2 === 0) mAnvil(at(3), 0.06);
    mHorn(ch.root + 24, t, len * 2 - E, bar % 4 === 0 ? 0.06 : 0.045);                                // гудящий горн на аккорде
    let pos = 0;
    for (const [m, l] of notes) { fiddle(m, at(pos), l * E * 0.92, pos === 0 || pos === 3 ? 0.13 : 0.1, l >= 2 && pos % 3 === 0); if (bar >= 8) flute(m + 12, at(pos), l * E * 0.85, 0.05, 'whistle'); pos += l; }
    if (bar % 2) for (let k = 0; k < 6; k += 2) dulcimer(up[k % up.length] + 12, at(k), 0.08);        // цимбальная дробь
    if (voiceNow && bar % 2 === 0) { const vt = ch.tones.filter(m => m >= 45 && m <= 60); if (vt[0]) voice(vt[(bar / 2) % vt.length], t, len * 2 - E, 0.06, 'o'); }   // мужской хор «о-о»
    for (let k = 0; k < 6; k++) tambourine(at(k), k % 3 === 0 ? 0.04 : 0.02);
    if (phraseEnd) { mHorn(ch.tones[2] + 12, at(0), len - E, 0.07); glock(ch.tones[ch.tones.length - 1], at(4), 0.06); }
  } else if (tr.name === 'Рассвет') {
    // арфа поднимается вверх по аккорду, виолончель дышит, колокольчики — лучи
    up.slice(0, 6).forEach((m, k) => harp(m + (k > 3 ? 12 : 0), at(k), 0.12 + k * 0.012));
    if (bar % 2 === 0) cello([ch.root, ch.root + 7], t, len * 2, 0.04);
    bassPluck(ch.root, t, 0.3);
    if (bar >= 8) bodhran(t, 0.08, 75);
    if (bar % 2 === 1) { glock(ch.tones[3], at(1), 0.05); glock(ch.tones[5] || ch.tones[4], at(3), 0.04); }
    kalimba(up[2] + 12, at(2), 0.06); if (bar % 2) kalimba(up[0] + 24, at(4), 0.045);
    if (phraseEnd) mHorn(ch.root + 24, t, len - E, 0.05);                                              // тихий горн-зов
    let pos = 0; for (const [m, l] of notes) { flute(m, at(pos), l * E * 0.95, pos === 0 ? 0.16 : 0.12); pos += l; }
    if (voiceNow && bar % 2 === 0) { const vt = ch.tones.filter(m => m >= 67 && m <= 79); if (vt[0]) voice(vt[(bar / 2) % vt.length], t, len * 2 - E, 0.05, 'a'); }
  } else if (tr.name === 'У воды') {
    // ручейковый перебор арфы в обе стороны, калимба поёт мотив, капли и волна, свирель изредка
    const arp = [0, 1, 2, 3, 2, 1].map(i => up[i % up.length] + 12);
    arp.forEach((m, k) => harp(m, at(k), k % 3 === 0 ? 0.17 : 0.1));
    bassPluck(ch.root, t, 0.35);
    if (bar % 2 === 0) mWave(t, len * 2, 0.026);
    let pos = 0; for (const [m, l] of notes) { kalimba(m, at(pos), pos === 0 ? 0.12 : 0.09); pos += l; }
    if (Math.random() < 0.7) droplet(at(1 + (bar * 2) % 4), 0.04);
    if (bar % 4 === 2) droplet(at(5), 0.03);
    if (bar % 4 === 0 && bar >= 4) { const m = notes[0][0]; flute(m + 12, t, len - E, 0.07, 'whistle'); }
    if (phraseEnd) { glock(ch.tones[ch.tones.length - 1], at(2), 0.05); glock(ch.tones[ch.tones.length - 2], at(3), 0.04); }
    for (let k = 1; k < 6; k += 2) shaker(at(k), 0.006);
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
      if (bar >= 16) flute(m + 12, at(pos), l * E * 0.9, 0.06, 'whistle');
      pos += l;
    }
    if (bar >= 32 && bar % 2 === 0) harp(counter, t, 0.22);
    if (phraseEnd) glock(ch.tones[ch.tones.length - 1], at(3), 0.06);
  }
}

function musicTick() {
  if (!Music.on || !Music.ctx || Music.ctx !== AudioCore.ctx || Music.ctx.state !== 'running' || document.hidden) return;
  const ctx = Music.ctx;
  // таймер отстал (вкладка была в фоне): не догоняем пропущенное, а начинаем с текущего момента
  if (Music.nextTime < ctx.currentTime - 0.3) Music.nextTime = ctx.currentTime + 0.15;
  if (ctx.currentTime - Music.moodT >= 1) { Music.moodT = ctx.currentTime; try { musicMoodTick(); } catch (e) { /* игра ещё не готова */ } }
  let guard = 0;
  while (Music.nextTime < ctx.currentTime + 0.5 && guard++ < 6) {
    const tr = TRACKS[Music.track];
    if (Music.bar >= tr.bars) {
      // смена трека с паузой в такт; новые вариации мелодий
      Music.nextTime += tr.eighth * 6;
      Music.track = nextTrackIndex();
      Music.bar = 0;
      const nt = TRACKS[Music.track];
      Music.songs[Music.track] = makeSong(nt, nt.seed + Math.floor(Math.random() * 1000));
      musicLevel(nt.level, Music.nextTime);
      continue;
    }
    if (Music.bar % 16 === 0 && Music.bar > 0) Music.songs[Music.track] = makeSong(tr, tr.seed + Music.bar * 7);
    scheduleBar(tr, Music.songs[Music.track], Music.bar, Music.nextTime);
    Music.nextTime += tr.eighth * 6;
    Music.bar++;
  }
}

// уровень трека — плавно к нужной отметке к моменту t
function musicLevel(level, t) {
  const g = Music.bus.gain, now = Music.ctx.currentTime;
  g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0.62 * level, Math.max(now + 0.05, t));
}

// Тревожный ночной трек стоит в списке последним; днём он не выбирается
const ALARM_TRACK = TRACKS.findIndex(t => t.name === 'Тревога');
const MOOD_TRACK = { night: ALARM_TRACK };
TRACKS.forEach((t, i) => { if (t.special) MOOD_TRACK[t.special] = i; });
const MOOD_SET = new Set(Object.values(MOOD_TRACK));           // эти треки сами не выбираются в обычной смене
function nextTrackIndex() {
  const mt = MOOD_TRACK[Music.mood];
  if (mt !== undefined) return mt;
  if (typeof isNightNow === 'function' && isNightNow()) return ALARM_TRACK;
  let n = (Music.track + 1) % TRACKS.length;
  while (MOOD_SET.has(n)) n = (n + 1) % TRACKS.length;
  return n;
}

// ---------- Настроение музыки ----------
// Раз в секунду смотрим, что происходит: схватка → «За дом»; ночь → «Тревога»; первый свет → «Рассвет»;
// камера у воды → «У воды»; иначе обычная смена. Бой вступает быстро, остальное — плавно.
function nearWaterView() {
  if (typeof R === 'undefined' || !R.canvas || typeof World === 'undefined' || !World.terrain) return false;
  const s = camScale(), cx = Math.floor((R.cam.x + R.canvas.clientWidth / s / 2) / TILE), cy = Math.floor((R.cam.y + R.canvas.clientHeight / s / 2) / TILE);
  let n = 0;
  for (let dy = -7; dy <= 7; dy += 2) for (let dx = -7; dx <= 7; dx += 2) { const x = cx + dx, y = cy + dy; if (inb(x, y) && World.terrain[idx(x, y)] === T_WATER) n++; }
  return n >= 7;                                                  // из 64 проб — не меньше 7 на воде
}
function computeMood() {
  if (typeof Game === 'undefined' || !Game.units) return 'day';
  const now = performance.now() / 1000;                           // реальные секунды: не зависят от скорости игры
  let fight = false;
  for (const u of Game.units) if (!u.dead && (u.fighting || (u.brk && u.brk.kind === 'fight'))) { fight = true; break; }
  if (!fight && Game.ents) for (const e of Game.ents) if (e.state === 'fight' || e.state === 'smash') { fight = true; break; }
  if (fight) Music.fightT = now;
  if (now - Music.fightT < 10) return 'battle';
  if (typeof isNightNow === 'function' && isNightNow()) return 'night';
  if (now < Music.dawnUntil) return 'dawn';
  // у воды: сперва 6 секунд подряд, уходит через 15; после ухода — пауза в минуту, чтобы не надоедало
  if (typeof nearWaterView === 'function' && nearWaterView()) Music.waterT = now; else Music.waterIn = 0;
  if (Music.mood === 'water') { if (now - Music.waterT < 15) return 'water'; Music.waterCool = now + 60; }
  else if (now - Music.waterT < 1) { Music.waterIn += 1; if (Music.waterIn >= 6 && now > Music.waterCool) return 'water'; }
  return 'day';
}
function musicMoodTick() {
  const m = computeMood();
  if (m === Music.mood) return;
  const prev = Music.mood;
  Music.mood = m;
  const cur = Music.track;
  if (m === 'day') { if (cur !== MOOD_TRACK.dawn && cur !== MOOD_TRACK.water) gotoTrack(nextTrackIndex(), false); return; }   // рассвет и воду дослушиваем
  if (cur !== MOOD_TRACK[m]) gotoTrack(MOOD_TRACK[m], false, m === 'battle' || prev === 'battle');
}

function makeSong(tr, seed) {
  const mel = composeTrack(tr, seed);
  return { mel, cnt: counterLine(tr, mel) };
}

function buildMixer(ctx) {
  Music.master = ctx.createGain(); Music.master.gain.value = 0.62;
  // мягкий компрессор склеивает инструменты и не даёт пикам резать уши
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = 0.012; comp.release.value = 0.25;
  Music.bus = ctx.createGain(); Music.bus.gain.value = 0.62;
  Music.bus.connect(comp); comp.connect(Music.master);
  Music.rev = ctx.createConvolver(); Music.rev.buffer = makeImpulse(ctx, 2.2);
  const rg = ctx.createGain(); rg.gain.value = 0.25; Music.rev.connect(rg); rg.connect(comp);
  Music.hall = ctx.createConvolver(); Music.hall.buffer = makeImpulse(ctx, 4.5, 2);
  const hg = ctx.createGain(); hg.gain.value = 0.35; Music.hall.connect(hg); hg.connect(comp);
  Music.noise = AudioCore.noise;
}

function startMusic() {
  if (Music.started) return;
  const ctx = audioCoreInit();
  if (!ctx) return;
  Music.started = true;
  Music.ctx = ctx;
  buildMixer(ctx);
  Music.master.connect(AudioCore.music);
  Music.songs = TRACKS.map(tr => makeSong(tr, tr.seed));
  Music.track = 0; Music.bar = 0;
  Music.nextTime = ctx.currentTime + 0.15;
  // первые секунды — плавный вход, а не сразу в полную силу
  Music.bus.gain.setValueAtTime(0.0001, ctx.currentTime);
  Music.bus.gain.linearRampToValueAtTime(0.62 * TRACKS[0].level, ctx.currentTime + 2.5);
  Music.timer = setInterval(musicTick, 80);
  audioSetBus('music', Music.on);
}

// Переключить трек: короткое затухание того, что уже запланировано, и сразу новая песня
function gotoTrack(i, announce, fast) {
  startMusic();
  if (!Music.ctx) return;
  if (announce && !Music.on) { setMusic(true); syncMusicBtn(); }
  const ctx = Music.ctx, t = ctx.currentTime, g = Music.bus.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0.0001, t + (announce || fast ? 0.3 : 1.6));
  const t0 = t + (announce || fast ? 0.55 : 1.8);
  Music.track = i;
  Music.bar = 0;
  const tr = TRACKS[Music.track];
  g.setValueAtTime(0.0001, t0); g.linearRampToValueAtTime(0.62 * tr.level, t0 + 0.8);
  Music.songs[Music.track] = makeSong(tr, tr.seed + Math.floor(Math.random() * 1000));
  Music.nextTime = t0 + 0.05;
  if (announce) toast(`Музыка: «${tr.name}»`);
}
function nextTrack() { gotoTrack(nextTrackIndex(), true); }

// ночью сам включается «Тревога», на рассвете — обычная музыка
function musicDayNight(night) {
  if (Music.prevNight === true && !night && typeof Game !== 'undefined') Music.dawnUntil = performance.now() / 1000 + 55;     // ночь кончилась — звучит «Рассвет»
  Music.prevNight = night;
  if (!Music.started || !Music.ctx) return;
  musicMoodTick();
}

let syncMusicBtn = () => {};

function setMusic(on) {
  Music.on = on;
  try { localStorage.setItem('feod.music', on ? '1' : '0'); } catch (e) { /* нет доступа к хранилищу */ }
  if (!Music.ctx) return;
  audioSetBus('music', on);
  if (on) Music.nextTime = Math.max(Music.nextTime, Music.ctx.currentTime + 0.15);
}

function initMusic() {
  // на локальном сервере (вкладки разработки и тестов) музыка по умолчанию выключена — не жужжит фоном из всех вкладок
  const dev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  try { const v = localStorage.getItem('feod.music'); Music.on = v === null ? !dev : v !== '0'; } catch (e) { Music.on = !dev; }
  audioKickOnGesture(startMusic);
  const btn = document.getElementById('music-btn');
  if (btn) {
    const sync = syncMusicBtn = () => { btn.classList.toggle('active', Music.on); btn.title = Music.on ? 'Музыка: вкл' : 'Музыка: выкл'; };
    btn.onclick = (e) => { e.stopPropagation(); startMusic(); setMusic(!Music.on); sync(); };
    sync();
  }
  const nb = document.getElementById('music-next');
  if (nb) nb.onclick = (e) => { e.stopPropagation(); nextTrack(); };
}
