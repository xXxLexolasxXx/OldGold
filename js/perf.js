'use strict';
// Производительность: счётчик на F3 (кадры, время отрисовки и шага, размер холста),
// режим «экономная графика» (холст в обычной плотности пикселей — заметно легче на
// больших и ретина-экранах) и автопереключение на него, если игра долго идёт медленно.

const Fps = { show: false, fps: 60, renderMs: 0, stepMs: 0, frames: 0, t0: 0, slow: 0, eco: false, el: null, crashes: 0, mem: [] };

// ---------- Мониторинг: «жив ли был прошлый запуск» и журнал памяти ----------
// Метка feod.alive ставится при запуске и снимается при штатном уходе в фон/закрытии. Если при старте
// она осталась — браузер убил вкладку (чаще всего из-за памяти): считаем сбои и включаем экономию.
const PERF_ALIVE = 'feod.alive', PERF_DIAG = 'feod.diag', PERF_CRASH = 'feod.crashes';
try {
  const n = +localStorage.getItem(PERF_CRASH) || 0;
  Fps.crashes = n + (localStorage.getItem(PERF_ALIVE) ? 1 : 0);
  if (Fps.crashes !== n) localStorage.setItem(PERF_CRASH, String(Fps.crashes));
  Fps.prevDiag = JSON.parse(localStorage.getItem(PERF_DIAG) || 'null');
} catch (e) { /* хранилище недоступно */ }

function perfCanvasMB() {
  let px = 0;
  for (const c of [R.canvas, typeof NIGHT !== 'undefined' && NIGHT.cv, MINI && MINI.base]) if (c) px += c.width * c.height;
  return px * 4 / 1048576 + terrCanvasMB();
}

// Сброс кэшей, которые пересоздаются сами; вызывается при нехватке памяти и когда вкладка уходит в фон
function perfTrim(hard) {
  try {
    if (typeof NIGHT !== 'undefined' && NIGHT.cv) { NIGHT.cv.width = NIGHT.cv.height = 1; }
    if (typeof RAMP_CACHE !== 'undefined') RAMP_CACHE.clear();
    for (const b of Game.buildings || []) if (b._site) { b._site.cv.width = b._site.cv.height = 1; b._site = null; }
    if (Game.floaters && Game.floaters.length > 20) Game.floaters.length = 0;
    if (Game.log && Game.log.length > 80) Game.log.splice(0, Game.log.length - 80);
    if (hard) { if (!Fps.eco) perfSetEco(true, true); if (typeof resize === 'function') resize(); }
  } catch (e) { console.warn('perfTrim', e); }
}

function perfSample() {
  const m = performance.memory;
  const e = {
    t: Math.round(Game.time), fps: +Fps.fps.toFixed(0), heap: m ? Math.round(m.usedJSHeapSize / 1048576) : null,
    lim: m ? Math.round(m.jsHeapSizeLimit / 1048576) : null, cvMB: Math.round(perfCanvasMB()),
    units: Game.units.length, fl: (Game.floaters || []).length, log: (Game.log || []).length, eco: Fps.eco ? 1 : 0,
  };
  Fps.mem.push(e); if (Fps.mem.length > 40) Fps.mem.shift();
  try { localStorage.setItem(PERF_DIAG, JSON.stringify({ at: Date.now(), ua: navigator.userAgent, dm: navigator.deviceMemory, dpr: window.devicePixelRatio, last: Fps.mem.slice(-12) })); } catch (x) { /* не критично */ }
  // куча близка к пределу (Chrome/Android) — чистим кэши и включаем экономию, пока вкладку не убили
  if (m && m.usedJSHeapSize > m.jsHeapSizeLimit * 0.7) { perfTrim(true); toast('Мало памяти — включена экономная графика'); }
  else if (e.cvMB > 320 && !Fps.eco) perfTrim(true);
  return e;
}
window.perfReport = () => ({ crashes: Fps.crashes, previous: Fps.prevDiag, now: Fps.mem.slice(-5) });


// Слабый телефон: сенсорный экран, мало памяти/ядер или прошлый запуск оборвался без закрытия (вкладку убил браузер)
function perfWeakDevice() {
  try {
    const touch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!touch) return false;
    const mem = navigator.deviceMemory || 0, cores = navigator.hardwareConcurrency || 0;
    return (mem && mem <= 4) || (cores && cores <= 6) || (window.devicePixelRatio || 1) >= 2.5 || Fps.crashes > 0;
  } catch (e) { return false; }
}
function perfLoadEco() {
  try {
    const v = localStorage.getItem('feod.eco');
    if (v === '1') return true;
    if (v === '0') return false;
    return perfWeakDevice();   // выбор игрока не сохранён — по умолчанию экономно на слабых телефонах
  } catch (e) { return false; }
}
function perfSetEco(on, silent) {
  Fps.eco = !!on;
  if (typeof terrSetLazy === 'function') terrSetLazy(on);   // земля: только полосы кадра, остальное выгружается
  try { localStorage.setItem('feod.eco', on ? '1' : '0'); } catch (e) { /* нет доступа к хранилищу */ }
  if (typeof resize === 'function') resize();
  perfMenuSync();
  if (!silent) toast(on ? 'Экономная графика: игра рисуется легче' : 'Обычная графика');
}

function perfMenuSync() {
  const b = document.getElementById('eco-btn');
  if (b) b.querySelector('span').textContent = Fps.eco ? 'Графика: экономная' : 'Графика: обычная';
}

{
  Fps.eco = perfLoadEco();
  // плотность пикселей холста: в экономном режиме всегда ×1
  const _dpr = screenDPR;
  screenDPR = function () { return Fps.eco ? 1 : _dpr(); };

  const _render = render;
  render = function () { const s = performance.now(); _render(); Fps.renderMs += (performance.now() - s - Fps.renderMs) * 0.1; };
  const _step = step;
  step = function (dt) { const s = performance.now(); _step(dt); Fps.stepMs += (performance.now() - s - Fps.stepMs) * 0.05; };

  const tick = now => {
    if (!Fps.t0) Fps.t0 = now;
    Fps.frames++;
    if (now - Fps.t0 >= 1000) {
      Fps.fps = Fps.frames * 1000 / (now - Fps.t0); Fps.frames = 0; Fps.t0 = now;
      // долго медленно (окно в фокусе, игра идёт) — включаем экономную графику сами
      const active = document.visibilityState === 'visible' && !Game.paused && !(document.getElementById('loading') && !document.getElementById('loading').classList.contains('hidden'));
      if (active && ((Fps.sampleN = (Fps.sampleN || 0) + 1) % 5 === 0)) perfSample();
      Fps.slow = active && Fps.fps < 28 && !Fps.eco ? Fps.slow + 1 : 0;
      if (Fps.slow >= 8 && (window.devicePixelRatio || 1) > 1) { Fps.slow = 0; perfSetEco(true); toast('Игра шла медленно — включена экономная графика (её можно выключить в меню)'); }
      if (Fps.show && Fps.el) {
        Fps.el.textContent = `${Fps.fps.toFixed(0)} кадр/с · отрисовка ${Fps.renderMs.toFixed(1)} мс · шаг ${Fps.stepMs.toFixed(1)} мс\n` +
          `холст ${R.canvas.width}×${R.canvas.height} · DPR ${(window.devicePixelRatio || 1).toFixed(2)} · ${Fps.eco ? 'экономно' : 'обычно'}\n` +
          `жителей ${Game.units.length} · зданий ${Game.buildings.length} · куч ${Game.piles.size}
` +
          `память: куча ${(Fps.mem[Fps.mem.length - 1] || {}).heap ?? '—'} МБ · холсты ${perfCanvasMB().toFixed(0)} МБ · сбоев ${Fps.crashes}` +
          (typeof crashSummary === 'function' ? `\nвылеты: ${crashSummary().text} · ошибок в журнале ${crashSummary().errors} (меню → «Скопировать журнал»)` : '');
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  try { localStorage.setItem(PERF_ALIVE, String(Date.now())); } catch (e) { /* ничего */ }
  const markGone = () => { try { localStorage.removeItem(PERF_ALIVE); } catch (e) { /* ничего */ } };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { markGone(); perfTrim(false); }   // в фоне держим меньше памяти
    else { try { localStorage.setItem(PERF_ALIVE, String(Date.now())); } catch (e) { /* ничего */ } }
  });
  window.addEventListener('pagehide', markGone);

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.code === 'F3') {
      e.preventDefault();
      Fps.show = !Fps.show;
      if (!Fps.el) {
        Fps.el = document.createElement('pre');
        Fps.el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:9998;margin:0;padding:5px 8px;background:rgba(0,0,0,.72);color:#9f9;font:11px/1.35 Consolas,monospace;border-radius:4px;pointer-events:none';
        document.body.appendChild(Fps.el);
      }
      Fps.el.style.display = Fps.show ? 'block' : 'none';
    }
  });

  // кнопка в боковом меню
  const _s = startGame;
  startGame = function () {
    _s();
    const list = document.querySelector('#tab-menu .menu-list');
    if (list && !document.getElementById('eco-btn')) {
      const b = document.createElement('button');
      b.id = 'eco-btn'; b.title = 'Экономная графика: игра рисуется в обычной плотности пикселей. F3 — показать кадры в секунду';
      b.innerHTML = '<span></span>';
      b.onclick = () => perfSetEco(!Fps.eco);
      const sub = document.getElementById('sub-btn');
      (sub && sub.parentElement === list ? sub : list.firstChild).insertAdjacentElement(sub ? 'afterend' : 'beforebegin', b);
      perfMenuSync();
      // журнал сбоев (js/crashlog.js): текст для автора — вылеты, ошибки, память, устройство
      if (typeof crashCopyLog === 'function') {
        const lb = document.createElement('button');
        lb.id = 'crashlog-btn'; lb.title = 'Скопировать журнал сбоев и вылетов, чтобы отправить автору (без ника и сохранений)';
        lb.innerHTML = '<span>Скопировать журнал</span>';
        lb.onclick = () => crashCopyLog();
        b.insertAdjacentElement('afterend', lb);
      }
    }
    if (Fps.eco) resize();
  };
}
