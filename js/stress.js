'use strict';
// Счётчик нагрузки (кадры/симуляция): показывается при ?perf в адресе.

// ---------- Счётчик нагрузки ----------

const Perf = { frames: [], steps: [], last: 0, el: null };

function perfFrame(frameMs, stepMs) {
  Perf.frames.push(frameMs); Perf.steps.push(stepMs);
  if (Perf.frames.length > 60) { Perf.frames.shift(); Perf.steps.shift(); }
  if (!location.search.includes('perf')) { if (Perf.el) Perf.el.style.display = 'none'; return; }
  const now = performance.now();
  if (now - Perf.last < 500) return;
  Perf.last = now;
  if (!Perf.el) {
    Perf.el = document.createElement('div');
    Perf.el.style.cssText = 'position:absolute;left:8px;bottom:8px;z-index:3;font:12px Consolas,monospace;color:#f6d458;background:rgba(10,7,5,0.75);padding:4px 8px;border:1px solid #5a4128;pointer-events:none';
    document.getElementById('view').appendChild(Perf.el);
  }
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const f = avg(Perf.frames);
  Perf.el.style.display = '';
  Perf.el.textContent = `${Math.round(1000 / f)} кадр/с · кадр ${f.toFixed(1)} мс · симуляция ${avg(Perf.steps).toFixed(1)} мс · жителей ${Game.units.length} · зданий ${Game.buildings.length}`;
}
