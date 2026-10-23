'use strict';
// Скины героя (КООП_ЗАБЕГ.md §2.4): шапки, бороды, накидки. Открываются за достижения забегов и за осколки ◆,
// надеваются в Таверне отряда («Переодеться») и видны везде: в забеге (мелкие пиксельные гномы dungeon.js)
// и в деревне — через облик героя heroapp.js (индексы 12–14 массива облика, поэтому в коопе их видят все).
// Рисунок свой: в деревне — те же векторные приёмы, что у гномов people.js (потом спрайт переводится в пиксели),
// в забеге — прямоугольники по 1 пикселю, как остальные фигурки подземелья.

// src — откуда вещь: 'achv' (достижение, cond(m) — открыто ли по мете забегов), 'shards' (за осколки ◆, shards — цена),
// 'shop' — задел под будущую лавку нарядов: такие вещи пока не продаются, открываются только записью m.skinsShop[слот+номер]
// (реальной оплаты в игре нет; правило «награды — только косметика» сохраняется)
const SK_HATS = [
  { n: 'Колпак-трофей Малгора', d: 'Индиго с кристаллом. Победите Малгора.', src: 'achv', cond: m => m.wins >= 1 },
  { n: 'Рогатый шлем', d: 'Пройдите 10 забегов.', src: 'achv', cond: m => m.runs >= 10 },
  { n: 'Шапка-кружка', d: 'Пена не стекает. Почти.', src: 'shards', shards: 5 },
  { n: 'Корона из кирок', d: 'Войдите в десятку рекордов дня.', src: 'achv', cond: m => !!m.top10 },
  { n: 'Капюшон следопыта', d: 'Ежедневный забег 7 дней подряд.', src: 'achv', cond: m => skStreak(m) >= 7 },
  { n: 'Шлем с пером отряда', d: 'Кооп-забег впятером.', src: 'achv', cond: m => (m.coopMax | 0) >= 5 },
  { n: 'Котелок', d: 'С ручкой. Звенит при ходьбе.', src: 'shards', shards: 3 },
];
const SK_BEARDS = [
  { n: 'Огненная борода', d: 'Победите Малгора три раза (Проклятие III).', src: 'achv', cond: m => m.wins >= 3 },
  { n: 'Борода с косичками', d: 'Пройдите 30 забегов.', src: 'achv', cond: m => m.runs >= 30 },
  { n: 'Борода в рунах', d: 'Руны светятся в темноте подземелья.', src: 'shards', shards: 4 },
  { n: 'Седая до пола', d: 'Одолейте 500 врагов в забегах.', src: 'achv', cond: m => (m.kills | 0) >= 500 },
  { n: 'Борода с бусинами', d: 'Пройдите кооп-забег с друзьями.', src: 'achv', cond: m => (m.coopRuns | 0) >= 1 },
];
const SK_CAPES = [
  { n: 'Плащ-знамя отряда', d: 'Три кооп-забега.', src: 'achv', cond: m => (m.coopRuns | 0) >= 3 },
  { n: 'Меховая накидка', d: 'Тёплая, пахнет козой.', src: 'shards', shards: 6 },
  { n: 'Плащ звездочёта', d: 'Победите Малгора, ни разу не получив удара.', src: 'achv', cond: m => !!m.flawless },
  { n: 'Алая мантия', d: 'Победите Малгора пять раз (Проклятие V).', src: 'achv', cond: m => m.wins >= 5 },
  { n: 'Плащ из мешковины', d: 'Пройдите первый забег.', src: 'achv', cond: m => m.runs >= 1 },
  { n: 'Лиственный плащ', d: 'Из дубовых листьев с мхом.', src: 'shards', shards: 3 },
];
const SK_SLOTS = [['hat', 'Шапка', SK_HATS], ['beard', 'Борода', SK_BEARDS], ['cape', 'Накидка', SK_CAPES]];

function skStreak(m) {
  const days = Object.keys(m.dayBest || {}).sort();
  let best = 0, run = 0, prev = null;
  for (const k of days) { const t = Date.parse(k + 'T00:00:00Z'); run = prev != null && t - prev === 86400000 ? run + 1 : 1; prev = t; best = Math.max(best, run); }
  return best;
}
function skOwned(m, slot, i) {
  const it = SK_SLOTS.find(s => s[0] === slot)[2][i];
  if (!it) return false;
  if (it.src === 'achv') return !!it.cond(m);
  if (it.src === 'shop') return !!(m.skinsShop && m.skinsShop[slot + i]);
  return !!(m.skinsBought && m.skinsBought[slot + i]);
}
function skWorn(m) { const w = m.skin && typeof m.skin === 'object' ? m.skin : {}; const ok = (s, v) => Number.isInteger(v) && v >= 0 && skOwned(m, s, v) ? v : -1; return { hat: ok('hat', w.hat), beard: ok('beard', w.beard), cape: ok('cape', w.cape) }; }

// ---------- в деревне: векторный рисунок поверх гнома people.js ----------
// координаты гнома: ступни в (0, 0), голова в (hx, hy) радиусом 3.8, плечи на shY ≈ −12, пояс на hipY ≈ −6
function skinHat(c, id, view, hx, hy, sway) {
  const e = view === 'E', b = hy - 1.1, s = e ? -1 : 1;
  const poly = (pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]); c.closePath(); c.fill(); };
  const el = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
  if (id === 0) {   // колпак Малгора: высокий индиго, золотая лента, зелёный кристалл
    poly([[hx - 4.4, b + 0.6], [hx + 4.4, b + 0.6], [hx + 1.2 + sway * 0.4, b - 12.5], [hx - 0.6 + sway * 0.4, b - 12.8]], '#2e3a8a');
    poly([[hx - 4.4, b + 0.6], [hx - 1.2, b + 0.6], [hx - 0.3 + sway * 0.4, b - 12.6]], '#3e4caa');
    c.fillStyle = '#d8b050'; c.fillRect(hx - 4.5, b - 1.2, 9, 1.4);
    poly([[hx, b - 5.4], [hx + 1.2, b - 3.6], [hx, b - 1.6], [hx - 1.2, b - 3.6]], '#6aff9a'); el(hx - 0.3, b - 4, 0.35, 0.6, '#eaffef');
  } else if (id === 1) {   // рогатый шлем
    el(hx, b - 1.6, 4.6, 3.6, '#8a929a'); c.fillStyle = '#6a727a'; c.fillRect(hx - 4.8, b - 0.4, 9.6, 1.4);
    el(hx - 1.2, b - 3, 1.4, 0.8, '#c8d0d8');
    for (const k of [-1, 1]) { if (e && k > 0) continue; c.strokeStyle = '#efe6cc'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(hx + k * 3.8, b - 2); c.quadraticCurveTo(hx + k * 7, b - 3, hx + k * 6.4, b - 7.4); c.stroke(); }
    c.fillStyle = '#c8a050'; c.fillRect(hx - 0.4, b - 5.2, 0.8, 4.6);
  } else if (id === 2) {   // шапка-кружка с пеной
    c.fillStyle = '#d8d0c0'; c.fillRect(hx - 3.6, b - 7, 7.2, 7.4); c.fillStyle = '#b8ae98'; c.fillRect(hx + 1.6, b - 7, 2, 7.4);
    c.strokeStyle = '#d8d0c0'; c.lineWidth = 1.1; c.beginPath(); c.arc(hx + 4.4 * s, b - 3.6, 1.8, -1.4, 1.4); c.stroke();
    for (const [dx, r] of [[-2.6, 1.6], [-0.6, 1.9], [1.6, 1.7], [3, 1.3]]) el(hx + dx, b - 7.2, r, r * 0.8, '#fffaf0');
    el(hx + 3.4 * s, b - 5.6, 0.8, 1.4, '#fffaf0'); c.fillStyle = '#e0a030'; c.fillRect(hx - 3, b - 5, 4.2, 4.6);
  } else if (id === 3) {   // корона из кирок
    c.fillStyle = '#c89226'; c.fillRect(hx - 4.4, b - 1.6, 8.8, 2); c.fillStyle = '#ffd84a'; c.fillRect(hx - 4.4, b - 1.6, 8.8, 0.6);
    for (const k of [-3, 0, 3]) { c.strokeStyle = '#6a4a2a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(hx + k, b - 1.4); c.lineTo(hx + k, b - 6); c.stroke(); c.strokeStyle = '#cfd4dc'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(hx + k - 1.8, b - 5.2); c.quadraticCurveTo(hx + k, b - 6.8, hx + k + 1.8, b - 5.2); c.stroke(); }
    el(hx, b - 0.6, 0.6, 0.6, '#c83a28');
  } else if (id === 4) {   // капюшон следопыта: зелёный, мягкий, край на глазах
    poly([[hx - 4.8, b + 1.4], [hx + 4.8, b + 1.4], [hx + 4.2, b - 4], [hx - 0.4 - 3 * s + sway, b - 8.6], [hx - 4.2, b - 4]], '#3e6a2e');
    poly([[hx - 4.8, b + 1.4], [hx - 2, b + 1.4], [hx - 3.2, b - 4.4]], '#4e7e3a');
    c.fillStyle = '#2a4a1e'; c.fillRect(hx - 4.6, b + 0.4, 9.2, 1);
  } else if (id === 5) {   // шлем с пером отряда
    el(hx, b - 1.4, 4.4, 3.4, '#9aa0aa'); c.fillStyle = '#7a8088'; c.fillRect(hx - 4.6, b - 0.4, 9.2, 1.2);
    c.strokeStyle = '#c8402a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx + 1.6 * s, b - 4); c.quadraticCurveTo(hx + 4 * s + sway, b - 9, hx - 1.4 * s + sway, b - 10.6); c.stroke();
    c.strokeStyle = '#ffd84a'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(hx + 1.6 * s, b - 4); c.quadraticCurveTo(hx + 3.6 * s + sway, b - 8.6, hx - 1 * s + sway, b - 10.2); c.stroke();
  } else if (id === 6) {   // котелок с ручкой
    el(hx, b - 0.2, 5, 1.6, '#3a3632'); c.fillStyle = '#4a4440'; c.fillRect(hx - 3.6, b - 5, 7.2, 5); el(hx, b - 5, 3.6, 1.1, '#5a524a');
    c.strokeStyle = '#2a2622'; c.lineWidth = 0.6; c.beginPath(); c.arc(hx, b - 5, 3.4, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(hx - 2.8, b - 4.4, 1, 3.6);
  }
}
function skinBeard(c, id, view, hx, hy) {
  const e = view === 'E', x0 = e ? hx + 0.4 : hx;
  const el = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
  if (id === 0) {   // огненная: оранжевые языки и искры
    for (const [dx, h, col] of [[-2.4, 6, '#e8601a'], [0, 8, '#ff9a2a'], [2.4, 6, '#e8601a'], [-1.2, 7, '#ffd25a'], [1.2, 7, '#ffd25a']]) { c.fillStyle = col; c.beginPath(); c.moveTo(x0 + dx - 1.4, hy + 1.6); c.lineTo(x0 + dx + 1.4, hy + 1.6); c.lineTo(x0 + dx * 0.6, hy + 1.6 + h); c.closePath(); c.fill(); }
    el(x0 + 2.8, hy + 8.6, 0.4, 0.4, '#fff2b0'); el(x0 - 2, hy + 9.4, 0.3, 0.3, '#ffd25a');
  } else if (id === 1) {   // косички с кольцами
    for (const k of e ? [1] : [-1, 1]) { for (let j = 0; j < 4; j++) el(x0 + k * 1.6, hy + 4 + j * 1.5, 0.9, 0.8, j % 2 ? '#a8703a' : '#c8823a'); c.fillStyle = '#d8b050'; c.fillRect(x0 + k * 1.6 - 0.9, hy + 9.6, 1.8, 0.6); }
  } else if (id === 2) {   // руны светятся
    c.fillStyle = '#7ad8ff'; for (const [dx, dy] of [[-1.6, 3], [1.4, 4.4], [-0.4, 6.2]]) { c.fillRect(x0 + dx, hy + dy, 0.4, 1.4); c.fillRect(x0 + dx - 0.4, hy + dy + 0.4, 1.2, 0.4); }
    c.fillStyle = 'rgba(122,216,255,0.25)'; c.beginPath(); c.ellipse(x0, hy + 4.6, 3.6, 3.4, 0, 0, Math.PI * 2); c.fill();
  } else if (id === 3) {   // седая до пола
    c.fillStyle = '#ece6cc'; c.beginPath(); c.moveTo(x0 - 3.2, hy + 1.4); c.lineTo(x0 + 3.2, hy + 1.4); c.quadraticCurveTo(x0 + 3.6, hy + 10, x0 + 1.4, hy + 15.6); c.lineTo(x0 - 1.4, hy + 15.6); c.quadraticCurveTo(x0 - 3.6, hy + 10, x0 - 3.2, hy + 1.4); c.fill();
    c.strokeStyle = '#cfc8a8'; c.lineWidth = 0.4; for (const dx of [-1.4, 0, 1.4]) { c.beginPath(); c.moveTo(x0 + dx, hy + 3); c.lineTo(x0 + dx * 0.5, hy + 15); c.stroke(); }
  } else if (id === 4) {   // бусины
    for (const [dx, dy, col] of [[-2, 4.4, '#c83a28'], [0, 6.4, '#4aa8d0'], [2, 4.4, '#ffd84a'], [-1, 8.2, '#4e8a2a'], [1, 8.2, '#e886a8']]) { el(x0 + dx, hy + dy, 0.7, 0.7, col); el(x0 + dx - 0.2, hy + dy - 0.2, 0.25, 0.25, '#ffffff'); }
  }
}
function skinCape(c, id, view, shY, hipY, top) {
  const e = view === 'E';
  const col = ['#c8402a', '#8a6a4a', '#1e2a6a', '#a8122a', '#a89068', '#4e8a2a'][id] || '#888', dark = ['#8a2a1c', '#6a4e34', '#121a48', '#70081a', '#7a6848', '#2e5a1a'][id] || '#555';
  c.save();
  if (top) c.globalAlpha = 0.96;
  c.fillStyle = col; c.beginPath();
  if (e) { c.moveTo(-1.6, shY - 0.4); c.lineTo(1.2, shY - 0.4); c.quadraticCurveTo(-3, hipY, -5.6, -0.6); c.lineTo(-2.4, -0.4); c.closePath(); }
  else { c.moveTo(-4.4, shY - 0.4); c.lineTo(4.4, shY - 0.4); c.lineTo(5.8, -0.6); c.lineTo(-5.8, -0.6); c.closePath(); }
  c.fill();
  c.fillStyle = dark;
  if (e) { c.beginPath(); c.moveTo(-4, -0.6); c.lineTo(-5.6, -0.6); c.lineTo(-3.4, hipY); c.closePath(); c.fill(); }
  else { c.fillRect(-5.8, -1.4, 11.6, 0.8); for (const k of [-3, 0, 3]) c.fillRect(k - 0.2, shY + 1, 0.4, -shY - 2.4); }
  // узоры по виду плаща
  if (id === 0 && !e) { c.fillStyle = '#ffd84a'; c.beginPath(); c.moveTo(0, shY + 3); c.lineTo(1.6, shY + 5); c.lineTo(0, shY + 7); c.lineTo(-1.6, shY + 5); c.closePath(); c.fill(); }
  if (id === 1) { c.fillStyle = '#e8dcc0'; for (let k = -4; k <= 4; k += 1.6) { c.beginPath(); c.ellipse(e ? -0.4 + k * 0.2 : k, shY - 0.2, 1, 0.8, 0, 0, Math.PI * 2); c.fill(); } }
  if (id === 2) { c.fillStyle = '#fff6c0'; for (const [x, y] of [[-3, -4], [2.4, -7], [-1, -9.6], [3.4, -2.4], [0.6, -3.2]]) c.fillRect(e ? x * 0.5 - 3 : x, y + (shY + 12) * 0, 0.6, 0.6); }
  if (id === 3) { c.fillStyle = '#d8b050'; c.fillRect(e ? -5.4 : -5.8, -1.6, e ? 3 : 11.6, 0.5); }
  if (id === 4) { c.fillStyle = '#6a5838'; for (const [x, y] of [[-2, -5], [2, -8], [1, -3]]) c.fillRect(e ? x * 0.4 - 3 : x, y, 1.2, 1); }
  if (id === 5) { c.fillStyle = '#6aa83e'; for (let k = -5; k <= 5; k += 2) { c.beginPath(); c.ellipse(e ? -4 + k * 0.15 : k, -1, 1, 1.4, 0.4, 0, Math.PI * 2); c.fill(); } }
  c.restore();
}

// ---------- в забеге: пиксели поверх маленького гнома (x — центр, by — уровень тела, face ±1) ----------
function skRun(c, sk, x, by, face, part) {
  if (!sk) return;
  const px = (dx, dy, w, h, col) => { c.fillStyle = col; c.fillRect(x + dx, by + dy, w, h); };
  if (part === 'cape' && sk.cape >= 0) {
    const col = ['#c8402a', '#8a6a4a', '#1e2a6a', '#a8122a', '#a89068', '#4e8a2a'][sk.cape];
    px(-5, -6, 10, 9, col); px(-5, 2, 10, 1, 'rgba(0,0,0,0.3)');
    if (sk.cape === 1) px(-5, -7, 10, 1, '#e8dcc0');
    if (sk.cape === 2) { px(-3, -3, 1, 1, '#fff6c0'); px(2, 0, 1, 1, '#fff6c0'); }
    if (sk.cape === 5) { px(-5, 2, 2, 1, '#6aa83e'); px(1, 2, 2, 1, '#6aa83e'); }
  }
  if (part === 'beard' && sk.beard >= 0) {
    const B = sk.beard;
    if (B === 0) { px(-3, -8, 6, 5, '#ff9a2a'); px(-2, -3, 4, 2, '#ffd25a'); px(-1, -1, 2, 1, '#e8601a'); }
    else if (B === 1) { px(-3, -8, 6, 4, '#c8823a'); px(-3, -4, 1, 3, '#a8703a'); px(2, -4, 1, 3, '#a8703a'); px(-3, -1, 1, 1, '#d8b050'); px(2, -1, 1, 1, '#d8b050'); }
    else if (B === 2) { px(-3, -8, 6, 5, '#6a5a4a'); px(-1, -7, 1, 2, '#7ad8ff'); px(1, -5, 1, 1, '#7ad8ff'); }
    else if (B === 3) { px(-3, -8, 6, 6, '#ece6cc'); px(-2, -2, 4, 4, '#ece6cc'); px(-1, 2, 2, 2, '#ece6cc'); }
    else if (B === 4) { px(-3, -8, 6, 5, '#9a7a52'); px(-2, -5, 1, 1, '#c83a28'); px(1, -5, 1, 1, '#4aa8d0'); px(0, -3, 1, 1, '#ffd84a'); }
  }
  if (part === 'hat' && sk.hat >= 0) {
    const H = sk.hat;
    if (H === 0) { px(-4, -14, 8, 3, '#2e3a8a'); px(-3, -17, 5, 3, '#2e3a8a'); px(-1, -19, 2, 2, '#2e3a8a'); px(-4, -12, 8, 1, '#d8b050'); px(-1, -15, 2, 2, '#6aff9a'); }
    else if (H === 1) { px(-4, -15, 8, 4, '#8a929a'); px(-4, -15, 8, 1, '#c8d0d8'); px(-6, -17, 2, 3, '#efe6cc'); px(4, -17, 2, 3, '#efe6cc'); }
    else if (H === 2) { px(-3, -17, 6, 6, '#d8d0c0'); px(-2, -16, 4, 4, '#e0a030'); px(-4, -18, 8, 2, '#fffaf0'); px(3 * face, -15, 2, 3, '#d8d0c0'); }
    else if (H === 3) { px(-4, -13, 8, 2, '#c89226'); px(-4, -16, 1, 3, '#cfd4dc'); px(0, -17, 1, 4, '#cfd4dc'); px(3, -16, 1, 3, '#cfd4dc'); px(-1, -12, 2, 1, '#c83a28'); }
    else if (H === 4) { px(-5, -14, 10, 4, '#3e6a2e'); px(-3 - 2 * face, -16, 5, 2, '#3e6a2e'); px(-5, -11, 10, 1, '#2a4a1e'); }
    else if (H === 5) { px(-4, -14, 8, 4, '#9aa0aa'); px(-4, -14, 8, 1, '#c8d0d8'); px(1 * face, -18, 1, 4, '#c8402a'); px(2 * face, -19, 1, 2, '#ffd84a'); }
    else if (H === 6) { px(-5, -11, 10, 1, '#3a3632'); px(-4, -15, 8, 4, '#4a4440'); px(-4, -16, 8, 1, '#5a524a'); px(-3, -14, 1, 3, 'rgba(255,255,255,0.25)'); }
  }
}

// облик деревни: индексы 12–14 массива heroapp (−1 — без скина)
function skApplyVillage(w) {
  if (typeof Game === 'undefined' || !Game.hero || !Game.hero.hero || typeof haClean !== 'function') return;
  const h = Game.hero, ap = (haOf(h) || Array(HA_MAX.length).fill(-1)).slice();
  while (ap.length < HA_MAX.length) ap.push(-1);
  ap[12] = w.hat; ap[13] = w.beard; ap[14] = w.cape;
  const clean = haClean(ap);
  if (typeof Coop !== 'undefined' && Coop.on) coopSend({ t: 'app', a: clean || [] });
  else { h.hero.app = clean || undefined; h._spr = null; HA.last = clean; }
}

// ---------- гардероб в Таверне ----------
function skOpen() {
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;inset:0;z-index:6;background:#000b;display:flex;align-items:center;justify-content:center;padding:8px;overflow:auto';
  Tav.el.appendChild(box);
  const btn = 'padding:5px 10px;background:#3a2410;color:#f1dfb0;border:1px solid #b8902c;border-radius:6px;cursor:pointer';
  let tab = 'hat';
  const draw = () => {
    const m = runMeta(), w = skWorn(m), items = SK_SLOTS.find(s => s[0] === tab)[2];
    const card = (it, i) => {
      const own = skOwned(m, tab, i), on = w[tab] === i, buy = !own && it.src === 'shards', shop = !own && it.src === 'shop';
      return `<div style="display:flex;gap:8px;align-items:center;margin:5px 0;padding:6px;border:1px solid ${on ? '#ffd84a' : '#6a4a1a'};border-radius:6px;${own ? '' : 'opacity:.75'}">
        <canvas data-pv="${i}" width="20" height="26" style="width:40px;height:52px;image-rendering:pixelated;background:#1a0f08;border-radius:4px"></canvas>
        <span style="flex:1"><b>${it.n}</b>${own ? '' : ' 🔒'}<br><small>${it.d}</small></span>
        ${on ? `<button data-sk="off" style="${btn}">Снять</button>` : own ? `<button data-sk="wear:${i}" style="${btn}">Надеть</button>` : buy ? `<button data-sk="buy:${i}" ${m.shards >= it.shards ? '' : 'disabled'} style="${btn};${m.shards >= it.shards ? '' : 'opacity:.5'}">${it.shards} ◆</button>` : shop ? `<button disabled style="${btn};opacity:.5">Лавка — скоро</button>` : ''}</div>`;
    };
    box.innerHTML = `<div style="background:#2a1a0e;border:2px solid #b8902c;border-radius:8px;padding:14px;max-width:440px;width:100%;color:#f1dfb0">
      <div style="font-size:18px;font-weight:700;margin-bottom:6px">Переодеться <span style="float:right;font-size:14px">◆ ${m.shards}</span></div>
      <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap">${SK_SLOTS.map(s => `<button data-sk="tab:${s[0]}" style="${btn};${tab === s[0] ? 'background:#6a4a1a' : ''}">${s[1]}</button>`).join('')}<button disabled title="Лавка нарядов откроется позже" style="${btn};opacity:.5">Лавка нарядов — скоро</button><button data-sk="cloak" style="${btn}">Цвет плаща: ${RUN_CLOAKS[m.cloak % RUN_CLOAKS.length][0]}</button></div>
      <div style="max-height:52vh;overflow:auto">${items.map(card).join('')}</div>
      <p style="font-size:12px;opacity:.8;margin:6px 0">Надетое видно и в забеге, и в деревне — в общей деревне его увидят все.</p>
      <div style="text-align:right"><button data-sk="x" style="${btn}">Закрыть</button></div></div>`;
    // превью: маленький гном забега с вещью
    box.querySelectorAll('canvas[data-pv]').forEach(cv => {
      const c = cv.getContext('2d'), sk = { hat: -1, beard: -1, cape: -1 }; sk[tab] = +cv.dataset.pv;
      const hold = Run.S; Run.S = Run.S || { t: Tav.t || 0 };
      try { runDrawDwarf(c, 10, 20, RUN_CLOAKS[m.cloak % RUN_CLOAKS.length][1], 1, false, false, false, null, 0, sk); } catch (e) { /* превью не важно */ }
      Run.S = hold;
    });
  };
  box.onclick = e => {
    const b = e.target.closest('[data-sk]'); if (!b || b.disabled) return;
    const [a, v] = b.dataset.sk.split(':'), m = runMeta();
    if (a === 'x') { box.remove(); tavernRender(); return; }
    if (a === 'tab') tab = v;
    if (a === 'cloak') { m.cloak = (m.cloak + 1) % RUN_CLOAKS.length; runMetaSave(m); }
    if (a === 'buy') { const it = SK_SLOTS.find(s => s[0] === tab)[2][+v]; if (it.src === 'shards' && m.shards >= it.shards) { m.shards -= it.shards; m.skinsBought = m.skinsBought || {}; m.skinsBought[tab + v] = 1; runMetaSave(m); RSfx.play('coin'); } }
    if (a === 'wear' || a === 'off') {
      m.skin = Object.assign({ hat: -1, beard: -1, cape: -1 }, m.skin || {}); m.skin[tab] = a === 'wear' ? +v : -1; runMetaSave(m);
      skApplyVillage(skWorn(m)); RSfx.play('pick');
      tavernSay(a === 'wear' ? 'Хорош! Хоть сейчас на ярмарку.' : 'Как скажешь. Скромность украшает.');
    }
    draw();
  };
  draw();
}
