'use strict';
// Эпохи облика зданий: поселение → деревня → город (вехи из goal.js) меняют вид всех зданий:
// эпоха 1 — солома и дерево, 2 — камень и дерево, 3 — дворцовый вид (материалы и детали — в bmodels.js,
// правила выбора эпохи и кэш спрайтов — в levels.js). Здесь — зрелищный переход: здания перестраиваются
// по одному, с лесами, пылью и бегущей снизу вверх линией нового вида.
// Состояния в сохранении нет: эпоха считается из вехи, а b.eraFx живёт только в этой вкладке.

const ERA_NAMES = ['', 'Солома и дерево', 'Камень и дерево', 'Дворцовая эпоха'];
const ERA_FX = { dur: 2.8, spread: 9, end: 0, pend: false };

function eraStart(from, to) {
  if (from === to || typeof Game === 'undefined' || !Game.buildings) return;
  const t0 = Game.time;
  for (const b of Game.buildings) {
    if (b.removed || b.state !== 'done' || b.isRoad || !b.def) continue;
    const lv = b.level || 1;
    if (buildingEra(b.type, lv, from) === buildingEra(b.type, lv, to)) continue;
    const t = t0 + 0.4 + (hashStr(String(b.id)) % 1000) / 1000 * ERA_FX.spread;
    b.eraFx = { from, t0: t };
    ERA_FX.end = Math.max(ERA_FX.end, t + ERA_FX.dur + 0.5);
  }
  ERA_FX.pend = true;
  if (to > from) {
    toast(`Новая эпоха: «${ERA_NAMES[to]}». Гномы схватились за молотки и перестраивают всё подряд`);
    logEvent('goal', `Эпоха зданий: «${ERA_NAMES[to]}»`);
  }
}

// по окончании перестройки выбрасываем спрайты ненужных эпох
function eraTick() {
  if (!ERA_FX.pend || Game.time < ERA_FX.end) return;
  ERA_FX.pend = false;
  const s = settleEra();
  eraEvict([s, Math.min(3, s + 1)]);
  if (typeof UI !== 'undefined' && UI.bicons) { UI.bicons = {}; UI.shown = null; if (typeof renderBuildMenu === 'function') renderBuildMenu(); }   // значки меню стройки — в новом облике
}

// Отрисовка перестройки: старый вид, поверх снизу вверх проступает новый; вокруг — леса и пыль.
// Возвращает true, если спрайт здания нарисован здесь целиком.
function eraDrawFx(c, b, spr, ox, oy) {
  const fx = b.eraFx, t = Game.time - fx.t0;
  if (t < 0) return false;
  if (t > ERA_FX.dur) { b.eraFx = null; eraFinish(b); return false; }
  const cur = buildingSprite(b.type, b.rot || 0, b.level);
  const p = t / ERA_FX.dur, e = p * p * (3 - 2 * p);
  const line = Math.round(spr.h * (1 - e));
  if (!fx.began) {
    fx.began = true;
    const cx = (b.x + b.w / 2) * TILE, cy = (b.y + b.h) * TILE - 4;
    fxBurst(cx, cy, 14, ['#d8c8a0', '#b8a888', '#e8dcc0'], 60, 40, 0.8, 2.2, 160);
    if (typeof sfxAt === 'function') sfxAt('build', cx, cy);
  }
  // новый вид — ниже линии, старый — выше
  c.save();
  c.beginPath(); c.rect(ox - 4, oy + line, spr.w + 8, spr.h - line + 40); c.clip();
  if (e > 0.5) c.drawImage(cur.shadow, ox, oy, cur.w, cur.h);
  c.drawImage(cur.canvas, ox, oy, cur.w, cur.h);
  c.restore();
  // леса: стойки по краям фасада и настилы до линии
  const fx0 = b.x * TILE, fw = b.w * TILE, gy = (b.y + b.h) * TILE, ly = oy + line;
  const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const top = Math.max(oy + 6, ly - 4);
  for (const px of [fx0 - 1, fx0 + fw / 2, fx0 + fw - 3]) { rect(px - 1, top, 5, gy - top, '#1a0f08'); rect(px, top, 3, gy - top, '#9a6a3c'); rect(px, top, 1, gy - top, '#c89a64'); }
  for (let y = gy - 12; y > top + 2; y -= 15) { rect(fx0 - 3, y - 1, fw + 6, 6, '#1a0f08'); rect(fx0 - 3, y, fw + 6, 4, '#8a5a34'); rect(fx0 - 3, y, fw + 6, 1, '#c89a64'); }
  // блик на линии и искры молотка
  c.fillStyle = 'rgba(255,240,200,0.55)'; c.fillRect(fx0 - 4, ly, fw + b.h * TILE * 0.5 + 8, 1);
  if (Math.random() < 0.25) {
    const sx = fx0 + Math.random() * fw, sy = Math.max(oy, ly + 2);
    fxBurst(sx, sy, 3, ['#ffe9a0', '#ffffff', '#ffcf70'], 40, 30, 0.35, 1.2, 200);
  }
  if (Math.random() < 0.12) fxBurst(fx0 + Math.random() * fw, gy - 3, 2, ['#d8c8a0', '#b8a888'], 30, 12, 0.7, 2.2, 40);
  return true;
}

function eraFinish(b) {
  const cx = (b.x + b.w / 2) * TILE, cy = (b.y + b.h / 2) * TILE;
  fxBurst(cx, cy, 22, ['#ffe08a', '#fff4c8', '#d8b070', '#cfc7b4'], 90, 60, 0.9, 2.4, 240);
}

{
  const _step = step;
  step = function (dt) { _step(dt); eraTick(); };
  if (typeof goalRankUp === 'function') {
    const _gru = goalRankUp;
    goalRankUp = function (r) {
      const from = settleEra();
      _gru(r);
      if (typeof document !== 'undefined') eraStart(from, settleEra());
    };
  }
  if (typeof goalMirrorIn === 'function') {
    const _gmi = goalMirrorIn;
    goalMirrorIn = function (m) {
      const had = Game.goal && Game.goal.mode, from = settleEra();
      _gmi(m);
      if (had && typeof document !== 'undefined') eraStart(from, settleEra());   // первый пакет после входа — без показа
    };
  }
  const _rgs = resetGameState;
  resetGameState = function () { _rgs(); ERA_FX.pend = false; ERA_FX.end = 0; };
}
