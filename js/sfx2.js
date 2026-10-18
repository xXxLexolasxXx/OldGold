'use strict';
// Второй слой звука. Подключается после sfx.js и weather.js, дополняет таблицу SFX:
//  • мелкие звуки гномов: пук, трубка, муха, свист, чих, урчание живота, отрыжка —
//    включаются сами по себе возле случайных гномов на экране и при событиях (молния, падение, испуг);
//  • интерфейс: щелчки кнопок, вкладки, закладка здания, подсказки — на своей шине, без панорамы;
//  • погода: заново сделанные дождь (шум + капли) и гром (с «приседанием» музыки);
//  • огонь: треск и шипение.

const GnomeSfx = { t: 3 + Math.random() * 3, cd: new Map() };

Object.assign(SFX_DEF, {
  toot: { pri: 2, gain: 0.45, poly: 1, cd: 0.5, len: 0.7 },
  pipe: { pri: 0, gain: 0.5, poly: 2, cd: 0.3, len: 1.3 },
  fly: { pri: 0, gain: 0.45, poly: 1, cd: 1, len: 2.7 },
  whistle: { pri: 1, gain: 0.3, poly: 1, cd: 0.5, len: 1.3 },
  sneeze: { pri: 2, gain: 0.38, poly: 1, cd: 0.3, len: 0.6 },
  rumble: { pri: 0, gain: 0.4, poly: 1, cd: 0.5, len: 1.1 },
  burp: { pri: 1, gain: 0.4, poly: 1, cd: 0.3, len: 0.5 },
  slipfly: { pri: 2, gain: 0.5, poly: 2, cd: 0.1, len: 0.5 },
  slide: { pri: 1, gain: 0.45, poly: 2, cd: 0.1, len: 0.8 },
  slipLie: { pri: 1, gain: 0.45, poly: 2, cd: 0.1, len: 0.3 },
});

Object.assign(SFX, {
  // «пу-пу-пуу»: два коротких и один длинный, с дребезжащим низким тоном
  toot: (d, t, v) => {
    const ctx = Sfx.ctx, r = 0.9 + v * 0.2;
    for (const [k, len, f] of [[0, 0.09, 130], [0.13, 0.08, 150], [0.26, 0.34, 110]]) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.connect(d);
      const o = tone(lp, 'sawtooth', f * r, f * r * 0.62, t + k, len, 0.5, 0.01);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();   // дрожание
      lfo.frequency.value = 38; lg.gain.value = 16; lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t + k); lfo.stop(t + k + len + 0.02);
      noiseHit(lp, 'bandpass', 300, 200, 1.2, t + k, len, 0.25, 0.01);
    }
  },
  // трубка: бульканье при затяжке, потом долгий выдох с дымом
  pipe: (d, t, v) => {
    for (const k of [0, 0.11, 0.2]) tone(d, 'sine', 240 + k * 500 + v * 40, 420 + k * 500, t + k, 0.07, 0.18, 0.01);
    breath(d, t + 0.35, 0.9, 1000, 400, 0.2, 0.25);
  },
  // муха: кружит, жужжание плывёт вверх-вниз
  fly: (d, t, v) => {
    const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 280; bp.Q.value = 2; bp.connect(d);
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 180 + v * 25;
    lfo.frequency.value = 3.2; lg.gain.value = 55; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    for (let k = 0; k < 4; k++) { g.gain.linearRampToValueAtTime(0.35, t + 0.3 + k * 0.55); g.gain.linearRampToValueAtTime(0.06, t + 0.6 + k * 0.55); }
    g.gain.linearRampToValueAtTime(0.0001, t + 2.6);
    o.connect(g); g.connect(bp); o.start(t); lfo.start(t); o.stop(t + 2.7); lfo.stop(t + 2.7);
  },
  // насвистывание весёлой попевки: чистый свист с лёгким «воздухом»
  whistle: (d, t, v) => {
    const mel = [[880, 988, 0.14], [988, 1175, 0.14], [1175, 1175, 0.28], [988, 880, 0.14], [880, 784, 0.32]];
    const r = v < 0.5 ? 1 : 1.122;
    let tt = t;
    for (const [a, b, len] of mel) { tone(d, 'sine', a * r, b * r, tt, len, 0.28, 0.025); noiseHit(d, 'bandpass', a * r * 2, b * r * 2, 8, tt, len, 0.05, 0.03); tt += len * 1.05; }
  },
  // а-а-апчхи!
  sneeze: (d, t) => {
    gnomeVoice(d, t, [[280, 500, 0.28]], 0.35, 1000);
    noiseHit(d, 'highpass', 2200, 1200, 0.8, t + 0.3, 0.16, 0.6, 0.004);
    gnomeVoice(d, t + 0.32, [[480, 240, 0.14]], 0.5, 1200);
  },
  // урчание голодного живота
  rumble: (d, t, v) => {
    const ctx = Sfx.ctx, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.connect(d);
    tone(lp, 'sawtooth', 70 + v * 8, 48, t, 0.55, 0.5, 0.15);
    tone(lp, 'sawtooth', 56, 82, t + 0.5, 0.5, 0.5, 0.1);
    noiseHit(lp, 'lowpass', 200, 120, 1, t, 1, 0.12, 0.2);
  },
  burp: (d, t, v) => { const ctx = Sfx.ctx, bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 1.5; bp.connect(d); tone(bp, 'sawtooth', 115 + v * 20, 68, t, 0.4, 0.7, 0.02); noiseHit(d, 'lowpass', 400, 200, 1, t, 0.35, 0.2, 0.02); },
  // огонь: треск — несколько сухих щелчков; шипение — пар от воды
  crackle: (d, t, v) => { for (let k = 0; k < 3; k++) noiseHit(d, 'bandpass', 1800 + Math.random() * 2500, 1200, 3, t + k * 0.05 + v * 0.03, 0.012, 0.3, 0.001); modal(d, t + v * 0.05, [[900 + Math.random() * 600, 1, 0.03]], 0.12, 0.001); },
  hiss: (d, t) => { noiseHit(d, 'highpass', 3500, 6000, 0.8, t, 0.9, 0.3, 0.12); noiseHit(d, 'bandpass', 900, 500, 1, t, 0.4, 0.12, 0.05); },
});

// у каждого звука свой кулдаун — чтобы не надоедали
const GNOME_SFX_CD = { toot: 25, pipe: 6, fly: 18, whistle: 20, sneeze: 30, rumble: 20, burp: 40 };
function gnomeSfx(kind, u, vel = 1, delay = 0) {
  if (!Sfx.ctx || !Sfx.on || u.inside) return false;
  const last = GnomeSfx.cd.get(kind) || -1e9;
  if (Game.time - last < GNOME_SFX_CD[kind]) return false;
  GnomeSfx.cd.set(kind, Game.time);
  sfxAt(kind, u.x * TILE, u.y * TILE, vel, delay);
  return true;
}

// Случайные звуки: раз в 3–8 секунд один гном на экране что-то издаёт
function gnomeSfxTick(dt) {
  if (!Sfx.ctx || !Sfx.on) return;
  GnomeSfx.t -= dt;
  if (GnomeSfx.t > 0) return;
  GnomeSfx.t = 3 + Math.random() * 5;
  const seen = Game.units.filter(u => !u.inside && !u.dead && !UNIT_TYPES[u.type].animal && u.type !== 'carter' && sfxPlace(u.x * TILE, u.y * TILE));
  if (!seen.length) return;
  const u = seen[(Math.random() * seen.length) | 0];
  const hungry = u.food < 0.35;
  const pool = [['toot', 2], ['fly', 2], ['whistle', 3], ['sneeze', 2], ['burp', 1], ['rumble', hungry ? 6 : 0.5]];
  if (u.anim === 'smoke') pool.push(['pipe', 12]);
  if (u.injury) pool.push(['fly', 3]);
  const tot = pool.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * tot;
  for (const [k, w] of pool) { r -= w; if (r <= 0) { gnomeSfx(k, u, 0.9); break; } }
}

// ---------- Интерфейс ----------
// Звуки без положения в мире: на шине интерфейса, тихие и короткие
const UI_SFX = {
  // щелчок кнопки: деревянный «тик»
  click: (d, t) => { modal(d, t, [[1900, 0.5, 0.035], [3100, 0.2, 0.025]], 0.25, 0.001); noiseHit(d, 'bandpass', 2500, 2000, 2, t, 0.012, 0.2, 0.001); },
  // вкладка: два тика
  tab: (d, t) => { UI_SFX.click(d, t); modal(d, t + 0.06, [[2400, 0.5, 0.035]], 0.18, 0.001); },
  // инструмент выбран: лёгкий «взял в руки» — шорох и тик
  tool: (d, t) => { noiseHit(d, 'bandpass', 1500, 900, 1, t, 0.06, 0.2, 0.01); modal(d, t + 0.03, [[1500, 0.5, 0.05]], 0.15, 0.001); },
  // здание заложено: колышек вбит в землю
  place: (d, t) => { noiseHit(d, 'bandpass', 700, 250, 1, t, 0.12, 0.4, 0.01); tone(d, 'sine', 300, 120, t, 0.08, 0.4, 0.003); modal(d, t, [[800, 0.4, 0.08], [1600, 0.2, 0.05]], 0.25); },
  // снос/стирание: короткий скрежет
  erase: (d, t) => noiseHit(d, 'bandpass', 1200, 500, 1.2, t, 0.14, 0.3, 0.01),
  // подсказка: мягкий колокольчик
  toast: (d, t) => modal(d, t, [[1760, 0.6, 0.45], [2640, 0.2, 0.25]], 0.18, 0.004),
  // нельзя: глухое «бом-бом»
  err: (d, t) => { tone(d, 'sine', 230, 190, t, 0.1, 0.35, 0.005); tone(d, 'sine', 200, 160, t + 0.13, 0.14, 0.35, 0.005); },
};
const UI_CD = { click: 0.05, tab: 0.1, tool: 0.1, place: 0.05, erase: 0.08, toast: 0.35, err: 0.3 };
const UiSfx = { last: new Map() };
function uiSfx(kind, vel = 1) {
  if (!Sfx.ctx || !Sfx.on || !UI_SFX[kind] || Sfx.ctx.state !== 'running') return;
  const t = Sfx.ctx.currentTime;
  if (t - (UiSfx.last.get(kind) || -1) < (UI_CD[kind] || 0.05)) return;
  UiSfx.last.set(kind, t);
  const g = Sfx.ctx.createGain(); g.gain.value = 0.5 * vel; g.connect(AudioCore.ui);
  UI_SFX[kind](g, t + 0.005);
}

// ---------- Погода ----------
// Дождь: два слоя шума (шелест и гул) и отдельные капли; громкость следует за силой дождя
function rainSound() {
  const ctx = Sfx.ctx;
  if (!ctx || !Sfx.on) { if (WX.snd && ctx) WX.snd.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); return; }
  if (WX.k < 0.01) {
    if (WX.snd) { const s = WX.snd; s.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(() => { try { s.src.stop(); s.src2.stop(); } catch (e) { /* уже остановлен */ } }, 1500); WX.snd = null; }
    return;
  }
  if (!WX.snd) {
    const g = ctx.createGain(); g.gain.value = 0;
    const mk = (type, f, q, rate, lvl) => {
      const src = ctx.createBufferSource(); src.buffer = Sfx.noise; src.loop = true; src.playbackRate.value = rate;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gg = ctx.createGain(); gg.gain.value = lvl;
      src.connect(fl); fl.connect(gg); gg.connect(g); src.start(0, Math.random() * 0.5);
      return src;
    };
    const src = mk('bandpass', 3200, 0.4, 1, 0.35), src2 = mk('lowpass', 480, 0.7, 0.6, 0.7);
    g.connect(AudioCore.amb);
    WX.snd = { g, src, src2, dropT: 0 };
  }
  WX.snd.g.gain.setTargetAtTime(0.2 * WX.k, ctx.currentTime, 0.6);
  // капли: редкие при мороси, частые в ливень; каждая со своим местом в стерео
  const s = WX.snd, now = ctx.currentTime;
  if (now >= s.dropT) {
    s.dropT = now + 0.04 + Math.random() * (0.5 - 0.42 * WX.k);
    const g = ctx.createGain(); g.gain.value = 0.12 * (0.4 + WX.k);
    let last = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.random() * 1.6 - 0.8; g.connect(p); last = p; }
    last.connect(AudioCore.amb);
    const f = 1200 + Math.random() * 3500;
    modal(g, now + 0.01, [[f, 1, 0.03], [f * 1.5, 0.3, 0.02]], 0.6, 0.001);
  }
}

// Гром: треск разряда, два раската и низкий гул; музыка на время отходит
function sfxThunder(delay = 0.3) {
  if (!Sfx.ctx || !Sfx.on) return;
  const ctx = Sfx.ctx, t = ctx.currentTime + 0.02 + delay;
  const o = ctx.createGain(); o.gain.value = 0.8; o.connect(Sfx.out);
  if (Sfx.verb) { const wg = ctx.createGain(); wg.gain.value = 0.4; o.connect(wg); wg.connect(Sfx.verb); }
  const near = Math.max(0, 1 - delay / 1.6);                                     // близкая молния — резче
  noiseHit(o, 'highpass', 2600, 700, 0.8, t, 0.22 + 0.1 * near, 0.5 + 0.4 * near, 0.003);   // треск
  noiseHit(o, 'lowpass', 480, 70, 0.9, t + 0.06, 3.2, 0.9, 0.18);                 // раскат
  noiseHit(o, 'lowpass', 280, 45, 0.7, t + 1.1 + Math.random() * 0.5, 2.6, 0.6, 0.35);
  tone(o, 'sine', 70, 28, t + 0.05, 2.2, 0.4, 0.12);
  audioDuck(0.45, 2.5, delay);
}

// ---------- Хуки ----------
{
  // Курящий гном затягивается трубкой
  const _unit = sfxUnit;
  sfxUnit = function (u, kind, delay = 0) {
    if (kind === 'smoke') { gnomeSfx('pipe', u, 1, delay / Math.max(1, Game.speed)); return; }
    _unit(u, kind, delay);
  };

  // испуг, падение, ушиб: иногда сам собой раздаётся «пу-пу-пуу»
  const _fl = sfxFloater;
  sfxFloater = function (text, x, y) {
    _fl(text, x, y);
    if ((text === 'А-а-а!' || text === 'Бух!' || text === 'Ай!') && Math.random() < 0.45) {
      const u = Game.units.reduce((b, c) => (!c.inside && Math.hypot(c.x - x, c.y - y) < 1.5 && (!b || Math.hypot(c.x - x, c.y - y) < Math.hypot(b.x - x, b.y - y)) ? c : b), null);
      if (u) gnomeSfx('toot', u, 1, 0.2);
    }
  };

  // молния: гномы на экране вскрикивают, один испуганно пукает
  const _bolt = lightningStrike;
  lightningStrike = function () {
    _bolt();
    if (!Sfx.ctx || !Sfx.on) return;
    const seen = Game.units.filter(u => !u.inside && !u.dead && isPerson(u) && sfxPlace(u.x * TILE, u.y * TILE));
    seen.slice().sort(() => Math.random() - 0.5).slice(0, 2).forEach((u, i) => sfxAt(i ? 'ouch' : 'scream', u.x * TILE, u.y * TILE, 0.9, 0.35 + Math.random() * 0.5));
    if (seen.length && Math.random() < 0.5) gnomeSfx('toot', seen[(Math.random() * seen.length) | 0], 0.9, 0.9);
  };

  const _tick = sfxTick;
  sfxTick = function (dt) { _tick(dt); gnomeSfxTick(dt); };

  // Интерфейс: щелчки всех кнопок, подсказки, выбор инструмента, закладка здания.
  // Оборачиваем функции после загрузки всех скриптов (main.js, hero.js подключаются позже).
  window.addEventListener('load', () => {
    document.addEventListener('click', e => {
      const el = e.target.closest && e.target.closest('button, .tab-btn, .toast');
      if (!el || el.id === 'sfx-btn' || el.id === 'music-btn') return;
      uiSfx(el.classList.contains('tab-btn') ? 'tab' : 'click');
    }, true);
    if (typeof toast === 'function') {
      const _toast = toast;
      toast = function (text, target) { _toast(text, target); uiSfx(target ? 'toast' : 'err', 0.8); };
    }
    if (typeof setTool === 'function') {
      const _setTool = setTool;
      setTool = function (tool) { _setTool(tool); if (tool) uiSfx('tool'); };
    }
    if (typeof onLeftClickTile === 'function') {
      const _click = onLeftClickTile;
      onLeftClickTile = function (t) {
        const tool = Game.tool, nB = Game.buildings.length, nR = Game.roadSites ? Game.roadSites.size : 0;
        _click(t);
        if (Game.buildings.length > nB || (Game.roadSites && Game.roadSites.size > nR)) uiSfx('place');
        else if (tool && tool.kind === 'erase') uiSfx('erase', 0.7);
      };
    }
  });
}
