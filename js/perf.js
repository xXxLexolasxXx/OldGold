'use strict';
// Производительность: счётчик на F3 (кадры, время отрисовки и шага, размер холста),
// режим «экономная графика» (холст в обычной плотности пикселей — заметно легче на
// больших и ретина-экранах) и автопереключение на него, если игра долго идёт медленно.

const Fps = { show: false, fps: 60, renderMs: 0, stepMs: 0, frames: 0, t0: 0, slow: 0, eco: false, el: null };

function perfLoadEco() { try { return localStorage.getItem('feod.eco') === '1'; } catch (e) { return false; } }
function perfSetEco(on, silent) {
  Fps.eco = !!on;
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
      Fps.slow = active && Fps.fps < 28 && !Fps.eco ? Fps.slow + 1 : 0;
      if (Fps.slow >= 8 && (window.devicePixelRatio || 1) > 1) { Fps.slow = 0; perfSetEco(true); toast('Игра шла медленно — включена экономная графика (её можно выключить в меню)'); }
      if (Fps.show && Fps.el) {
        Fps.el.textContent = `${Fps.fps.toFixed(0)} кадр/с · отрисовка ${Fps.renderMs.toFixed(1)} мс · шаг ${Fps.stepMs.toFixed(1)} мс\n` +
          `холст ${R.canvas.width}×${R.canvas.height} · DPR ${(window.devicePixelRatio || 1).toFixed(2)} · ${Fps.eco ? 'экономно' : 'обычно'}\n` +
          `жителей ${Game.units.length} · зданий ${Game.buildings.length} · куч ${Game.piles.size}`;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

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
    }
    if (Fps.eco) resize();
  };
}
