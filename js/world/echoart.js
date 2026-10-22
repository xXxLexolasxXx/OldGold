'use strict';
// Эхо павших, этап 4 (МАЛГОР_ОСТАЛОСЬ.md): у каждого призрака свой облик — тот, кем он был.
// Герои — по классу (шлем и меч воина, капюшон и лук лучника, шляпа и посох мага, рога варвара, нимб жреца…),
// гномы — по профессии (колпак её цвета и инструмент: топор лесоруба, кирка шахтёра, свеча, коса пахаря…),
// рекруты — гном в колпаке цвета гильдии с её оружием; фонарщик — с лампой, «Огонёк Лампы» — блуждающий огонёк.
// Кадры (задание этапа 4): парение 9, атака 8 (замах 4, удар 3, возврат 1), появление 6, исчезновение 6, удар 4.
// Кадры рисуются один раз в маленький холст и лежат в кэше (ключ: облик + действие + кадр); спрайты
// ночной нечисти из ghosts.js не используются. Рисует FSPEC.echo.draw → gdDrawEcho (guards.js).

const EC_W = 40, EC_H = 54, EC_OX = 20, EC_OY = 48;
const EC_CACHE = new Map(), EC_CACHE_MAX = 700;
const EC_UP = new Map();                       // когда призрак встал (по id): появление — 6 кадров после выхода из тумана

const EC_HERO = 'rgb(112,214,150)', EC_GNOME = 'rgb(196,160,255)';
// облик героя/рекрута по классу: убор и оружие
const EC_CLS = {
  warrior:   { head: 'helm',   wpn: 'sword' },
  paladin:   { head: 'helm',   wpn: 'sword', shield: 1, halo: 1 },
  barbarian: { head: 'horns',  wpn: 'axe' },
  archer:    { head: 'hood',   wpn: 'bow' },
  monk:      { head: 'band',   wpn: 'fist' },
  rogue:     { head: 'hood',   wpn: 'dagger', mask: 1 },
  bard:      { head: 'feather', wpn: 'lute' },
  mage:      { head: 'wizard', wpn: 'staff' },
  druid:     { head: 'antler', wpn: 'staff' },
  priest:    { head: 'mitre',  wpn: 'mace', halo: 1 },
};
// гном по профессии: инструмент
const EC_TOOL = {
  woodcutter: 'axe', carpenter: 'saw', stonemason: 'hammer', builder: 'hammer', farmer: 'scythe', hopgrower: 'scythe', miller: 'sack',
  baker: 'pin', miner: 'pick', smelter: 'tongs', breeder: 'staff', herder: 'staff', stableman: 'pitch', butcher: 'cleaver', tanner: 'hammer',
  armorer: 'hammer', enchanter: 'staff', brewer: 'mug', carter: 'whip', lamplighter: 'lamp', serf: 'fist',
};

function ecLook(L) {
  const k = L.k || 'gnome', c = L.c || '';
  if (c === 'lamp') return { key: 'wisp', wisp: 1 };
  if (k === 'hero') { const C = EC_CLS[c] || EC_CLS.warrior; return { key: 'h' + c, hero: 1, col: EC_HERO, acc: (GCLS[c] && GCLS[c].col) || '#e0704a', ...C }; }
  if (k === 'rec' || EC_CLS[c]) { const C = EC_CLS[c] || EC_CLS.warrior; return { key: 'r' + c, col: EC_GNOME, cap: (GCLS[c] && GCLS[c].col) || '#8a6aa0', wpn: C.wpn, shield: C.shield }; }
  const O = typeof OUTFIT !== 'undefined' && OUTFIT[c] || {};
  const cap = c === 'serf' || O.cap === 'serf' ? '#4e8a2a' : O.cap === 'baker' ? 'toque' : O.cap === 'wizard' ? 'wizard' : O.cap || '#b03a2a';
  return { key: 'g' + c, col: EC_GNOME, cap, wpn: EC_TOOL[c] || 'fist', candle: c === 'miner' };
}

// ---------- кадр ----------
function ecFrame(N) {
  const t = Game.time;
  if (N.st === 'die') return ['out', Math.min(5, Math.floor(N.dt / 0.2))];
  if (N.st === 'vanish') return ['out', Math.min(5, Math.floor(N.vt / 0.22))];
  if (N.st === 'emerge') return ['in', 0];
  if (!EC_UP.has(N.id)) { EC_UP.set(N.id, t); if (EC_UP.size > 64) EC_UP.delete(EC_UP.keys().next().value); }
  const up = t - EC_UP.get(N.id);
  if (up >= 0 && up < 0.9) return ['in', Math.min(5, Math.floor(up / 0.15))];
  if (t - (N.hurtT || -9) < 0.32) return ['hurt', Math.min(3, Math.floor((t - N.hurtT) / 0.08))];
  if (N.st === 'atk' && N.atkT < 0.56) return ['atk', Math.min(7, Math.floor(N.atkT / 0.07))];
  return ['hov', Math.floor((t + (N.id % 9) * 0.11) / 0.12) % 9];
}

// ---------- рисование кадра в холст ----------
const ecP = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

function ecWeapon(c, w, acc) {
  // рисуется в системе руки: (0,0) — кисть, вниз по +y — продолжение руки
  const M = '#e8f8ff', D = 'rgba(40,30,70,0.7)';
  switch (w) {
    case 'sword': ecP(c, -1, 0, 3, 2, acc); ecP(c, 0, -12, 2, 12, M); ecP(c, 0, -13, 1, 1, M); break;
    case 'axe': ecP(c, 0, -12, 1, 14, '#c8b090'); ecP(c, 1, -12, 4, 5, M); ecP(c, 4, -13, 1, 7, M); break;
    case 'dagger': ecP(c, 0, -6, 1, 6, M); ecP(c, -1, 0, 3, 1, acc); break;
    case 'bow': ecP(c, -3, -9, 1, 18, '#c8b090'); ecP(c, -2, -10, 1, 1, '#c8b090'); ecP(c, -2, 9, 1, 1, '#c8b090'); ecP(c, -1, -9, 1, 18, 'rgba(255,255,255,0.5)'); break;
    case 'staff': ecP(c, 0, -16, 1, 22, '#c8b090'); ecP(c, -1, -19, 3, 3, acc); ecP(c, 0, -18, 1, 1, '#ffffff'); break;
    case 'mace': ecP(c, 0, -8, 1, 10, '#c8b090'); ecP(c, -1, -11, 3, 3, M); break;
    case 'lute': ecP(c, -2, -3, 5, 5, '#c89060'); ecP(c, 0, -10, 1, 7, '#a07040'); ecP(c, 0, -1, 1, 1, D); break;
    case 'hammer': ecP(c, 0, -8, 1, 10, '#c8b090'); ecP(c, -2, -10, 5, 3, M); break;
    case 'pick': ecP(c, 0, -9, 1, 11, '#c8b090'); ecP(c, -4, -10, 9, 2, M); ecP(c, -4, -9, 1, 1, M); ecP(c, 4, -9, 1, 1, M); break;
    case 'saw': ecP(c, 0, -2, 2, 3, '#c8b090'); ecP(c, -1, -11, 4, 9, M); for (let i = 0; i < 4; i++) ecP(c, 3, -10 + i * 2, 1, 1, M); break;
    case 'scythe': ecP(c, 0, -14, 1, 18, '#c8b090'); ecP(c, -6, -15, 7, 1, M); ecP(c, -6, -14, 2, 1, M); break;
    case 'pitch': ecP(c, 0, -14, 1, 18, '#c8b090'); ecP(c, -1, -15, 3, 1, M); ecP(c, -1, -18, 1, 3, M); ecP(c, 1, -18, 1, 3, M); ecP(c, 0, -18, 1, 3, M); break;
    case 'tongs': ecP(c, 0, -9, 1, 10, M); ecP(c, 2, -9, 1, 10, M); ecP(c, 0, -11, 3, 2, '#ff9a50'); break;
    case 'cleaver': ecP(c, 0, -2, 1, 3, '#c8b090'); ecP(c, -1, -8, 5, 6, M); break;
    case 'pin': ecP(c, -1, -7, 3, 9, '#e8d8b8'); ecP(c, 0, -9, 1, 2, '#c8b090'); break;
    case 'mug': ecP(c, -2, -4, 5, 5, '#d8a858'); ecP(c, -2, -5, 5, 1, '#ffffff'); ecP(c, 3, -3, 1, 3, '#d8a858'); break;
    case 'sack': ecP(c, -3, -5, 6, 7, '#e8e0c8'); ecP(c, -1, -6, 2, 1, '#c8b090'); break;
    case 'whip': ecP(c, 0, -5, 1, 6, '#c8b090'); ecP(c, 1, -7, 3, 1, '#c8b090'); ecP(c, 4, -6, 2, 1, '#c8b090'); break;
    case 'lamp': ecP(c, 0, 0, 1, 3, '#8a8a9a'); ecP(c, -2, 3, 5, 6, '#8a8a9a'); ecP(c, -1, 4, 3, 4, '#fff0a0'); break;
    default: ecP(c, -1, -2, 3, 3, 'rgba(255,255,255,0.7)');        // кулак
  }
}

function ecPaintWisp(c, an, f) {
  // «Огонёк Лампы»: язычок пламени с глазками
  const bob = an === 'hov' ? Math.round(Math.sin(f / 9 * 6.283) * 2) : 0, h = [10, 12, 13, 12, 11, 10, 12, 13, 11][an === 'hov' ? f : 0];
  const g = c.createRadialGradient(0, -14 + bob, 0, 0, -14 + bob, 14);
  g.addColorStop(0, 'rgba(255,230,140,0.55)'); g.addColorStop(1, 'rgba(255,200,90,0)');
  c.fillStyle = g; c.fillRect(-16, -30 + bob, 32, 32);
  ecP(c, -4, -10 + bob - h, 8, h, 'rgba(255,170,60,0.85)'); ecP(c, -3, -8 + bob - h, 6, h - 2, '#ffd070'); ecP(c, -1, -12 + bob - h, 2, 3, '#ffd070');
  ecP(c, -2, -16 + bob, 1, 2, '#3a1a40'); ecP(c, 1, -16 + bob, 1, 2, '#3a1a40');
  if (an === 'atk' && f >= 3 && f <= 5) { ecP(c, 4, -20 + bob, 8, 3, 'rgba(255,220,120,0.8)'); ecP(c, 10, -21 + bob, 3, 5, '#fff4c0'); }
}

function ecPaint(c, V, an, f) {
  if (V.wisp) { ecPaintWisp(c, an, f); return; }
  const H = !!V.hero, top = H ? -32 : -26, col = V.col;
  const bob = an === 'hov' ? Math.round(Math.sin(f / 9 * 6.283) * 1.5) : an === 'hurt' ? [1, 2, 1, 0][f] : 0;
  const lean = an === 'atk' ? [0, -1, -1, -2, 1, 2, 2, 1][f] : an === 'hurt' ? -[1, 2, 1, 0][f] : 0;
  const arm = an === 'atk' ? [-0.5, -1.3, -2.1, -2.5, -0.5, 0.9, 1.3, 0.5][f] : -0.35 + (an === 'hov' ? Math.sin(f / 9 * 6.283 + 1) * 0.12 : 0);
  c.save();
  c.translate(lean, -4 + bob);
  // свечение
  const g = c.createRadialGradient(0, top + 12, 0, 0, top + 12, 18);
  g.addColorStop(0, col.replace('rgb', 'rgba').replace(')', ',0.35)')); g.addColorStop(1, col.replace('rgb', 'rgba').replace(')', ',0)'));
  c.fillStyle = g; c.fillRect(-20, top - 6, 40, 40);
  // хвост вместо ног: колышется (парение 9 кадров)
  const tw = an === 'hov' ? f : an === 'atk' ? f + 2 : 3;
  for (let i = 0; i < 4; i++) {
    const w = 8 - i * 2, dx = Math.round(Math.sin((tw + i * 2) / 9 * 6.283) * (1 + i * 0.6));
    ecP(c, -w / 2 + dx, -4 + i * 2, w, 2, col);
  }
  // тело: балахон шире к подолу; у героя — плащ цвета класса за спиной
  const bodyH = H ? 13 : 10, bodyY = -4 - bodyH, sw = H ? 6 : 5;
  if (H) { ecP(c, -sw - 1, bodyY + 1, sw * 2 + 2, bodyH + 1, V.acc); ecP(c, -sw - 1, bodyY + bodyH + 2, 3, 2, V.acc); }
  for (let y = 0; y < bodyH; y++) { const w = sw + Math.floor(y / bodyH * 2.5); ecP(c, -w, bodyY + y, w * 2, 1, col); ecP(c, -w, bodyY + y, 2, 1, 'rgba(255,255,255,0.35)'); }
  ecP(c, -sw - 1, bodyY + bodyH - 3, sw * 2 + 2, 1, 'rgba(60,40,110,0.4)');            // пояс
  ecP(c, -sw - 2, bodyY + 2, 2, H ? 7 : 6, col); ecP(c, -sw - 2, bodyY + (H ? 9 : 8), 2, 2, 'rgba(255,255,255,0.7)');   // вторая рука
  if (V.shield) { ecP(c, -sw - 5, bodyY + 3, 6, 8, '#e8f0ff'); ecP(c, -sw - 4, bodyY + 6, 4, 1, V.acc || V.cap); ecP(c, -sw - 3, bodyY + 4, 2, 5, V.acc || V.cap); }
  // голова: пустые глазницы с искрой, борода (герой — тоже гном, но выше и с плащом)
  const hy = bodyY - 7;
  ecP(c, -4, hy, 8, 7, col); ecP(c, -4, hy, 8, 1, 'rgba(255,255,255,0.4)');
  ecP(c, -3, hy + 2, 2, 2, '#2a1a40'); ecP(c, 1, hy + 2, 2, 2, '#2a1a40');
  ecP(c, -2, hy + 2, 1, 1, '#ffffff'); ecP(c, 2, hy + 2, 1, 1, '#ffffff');
  if (V.mask) ecP(c, -4, hy + 4, 8, 2, '#3a2a50');
  else { ecP(c, -4, hy + 5, 8, 4, '#f0ecff'); ecP(c, -3, hy + 9, 6, 2, '#f0ecff'); ecP(c, -1, hy + 11, 2, H ? 2 : 1, '#f0ecff'); }
  // убор
  const hd = V.head, a = V.acc;
  if (H) {
    if (hd === 'helm') { ecP(c, -5, hy - 3, 10, 4, '#e0e8f0'); ecP(c, -5, hy - 3, 10, 1, '#ffffff'); ecP(c, -1, hy - 5, 2, 2, a); ecP(c, -5, hy + 1, 1, 4, '#e0e8f0'); ecP(c, 4, hy + 1, 1, 4, '#e0e8f0'); ecP(c, 0, hy + 1, 1, 3, '#e0e8f0'); }
    else if (hd === 'horns') { ecP(c, -4, hy - 2, 8, 3, '#c8b090'); ecP(c, -7, hy - 4, 2, 3, '#f0ecd8'); ecP(c, 5, hy - 4, 2, 3, '#f0ecd8'); ecP(c, -8, hy - 6, 1, 2, '#f0ecd8'); ecP(c, 7, hy - 6, 1, 2, '#f0ecd8'); }
    else if (hd === 'hood') { ecP(c, -5, hy - 2, 10, 3, a); ecP(c, -5, hy, 2, 6, a); ecP(c, 3, hy, 2, 6, a); ecP(c, -2, hy - 4, 4, 2, a); }
    else if (hd === 'band') { ecP(c, -4, hy, 8, 1, a); ecP(c, 4, hy, 2, 1, a); ecP(c, 5, hy + 1, 1, 2, a); }
    else if (hd === 'feather') { ecP(c, -5, hy - 2, 10, 2, a); ecP(c, -3, hy - 4, 6, 2, a); ecP(c, 3, hy - 9, 1, 6, '#ffffff'); ecP(c, 4, hy - 8, 1, 4, '#ffffff'); }
    else if (hd === 'wizard') { ecP(c, -6, hy - 1, 12, 2, a); ecP(c, -4, hy - 4, 8, 3, a); ecP(c, -2, hy - 7, 5, 3, a); ecP(c, 1, hy - 10, 3, 3, a); ecP(c, 3, hy - 11, 2, 1, a); ecP(c, -1, hy - 4, 1, 1, '#fff0a0'); }
    else if (hd === 'antler') { ecP(c, -4, hy - 1, 8, 2, '#7ac88a'); ecP(c, -6, hy - 6, 1, 5, '#e8d8b8'); ecP(c, -8, hy - 5, 2, 1, '#e8d8b8'); ecP(c, 5, hy - 6, 1, 5, '#e8d8b8'); ecP(c, 6, hy - 5, 2, 1, '#e8d8b8'); }
    else if (hd === 'mitre') { ecP(c, -3, hy - 4, 6, 4, '#f4f0e0'); ecP(c, -2, hy - 6, 4, 2, '#f4f0e0'); ecP(c, -1, hy - 7, 2, 1, '#f4f0e0'); ecP(c, -1, hy - 4, 2, 3, a); }
    if (V.halo) { c.strokeStyle = 'rgba(255,240,160,0.8)'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, hy - (hd === 'mitre' ? 9 : 6), 6, 2, 0, 0, 7); c.stroke(); }
  } else {
    const cp = V.cap;
    if (cp === 'toque') { ecP(c, -4, hy - 2, 8, 2, '#ffffff'); ecP(c, -5, hy - 7, 10, 5, '#ffffff'); }
    else if (cp === 'wizard') { ecP(c, -5, hy - 1, 10, 2, '#5a4aa8'); ecP(c, -3, hy - 4, 6, 3, '#5a4aa8'); ecP(c, -1, hy - 8, 4, 4, '#5a4aa8'); ecP(c, 1, hy - 10, 2, 2, '#5a4aa8'); ecP(c, 0, hy - 3, 1, 1, '#fff0a0'); }
    else {                                     // гномий колпак цвета профессии: свисает набок
      ecP(c, -5, hy - 2, 10, 3, cp); ecP(c, -4, hy - 5, 8, 3, cp); ecP(c, -2, hy - 7, 6, 2, cp); ecP(c, 1, hy - 8, 4, 1, cp); ecP(c, 4, hy - 7, 2, 2, cp);
      ecP(c, -5, hy - 2, 10, 1, 'rgba(255,255,255,0.3)');
      if (V.candle) { ecP(c, 0, hy - 10, 2, 3, '#f4f0e0'); ecP(c, 0, hy - 12 - (f & 1), 2, 2, '#ffd070'); }
    }
  }
  // рука с оружием или инструментом
  c.save(); c.translate(sw, bodyY + 2); c.rotate(arm);
  ecP(c, 0, 0, 2, H ? 7 : 6, col);
  c.translate(1, H ? 7 : 6); c.rotate(an === 'atk' ? 1.2 : 0.3 - arm);      // в парении оружие держит стоймя, в атаке — продолжает взмах
  ecWeapon(c, V.wpn, V.acc || V.cap);
  c.restore();
  // след удара (кадры удара атаки)
  if (an === 'atk' && f >= 4 && f <= 6) {
    c.strokeStyle = `rgba(255,255,255,${0.75 - (f - 4) * 0.25})`; c.lineWidth = 2;
    c.beginPath(); c.arc(sw, bodyY + 2, H ? 15 : 12, -1.9, -1.9 + (f - 3) * 0.9); c.stroke();
  }
  c.restore();
}

// готовый кадр из кэша; появление/исчезновение и вспышка удара — поверх позы
function ecSprite(V, an, f) {
  const key = V.key + '|' + an + '|' + f;
  let cv = EC_CACHE.get(key);
  if (cv) return cv;
  cv = mkCanvas(EC_W, EC_H);
  const c = cv.getContext('2d');
  c.save(); c.translate(EC_OX, EC_OY);
  if (an === 'in') {                           // встаёт из земли: снизу вверх, у ног — дымка
    const k = (f + 1) / 6;
    c.save(); c.beginPath(); c.rect(-EC_OX, -EC_OY, EC_W, EC_OY + 1); c.clip();
    c.translate(0, Math.round((1 - k) * 30));
    ecPaint(c, V, 'hov', 0);
    c.restore();
    for (let i = 0; i < 4; i++) ecP(c, -10 + i * 6, -2 - ((i + f) % 3), 4, 2, `rgba(200,180,255,${0.6 - k * 0.4})`);
  } else if (an === 'out') {                   // тает: поднимается и рассыпается точками
    c.save(); c.translate(0, -f * 2); ecPaint(c, V, 'hov', f); c.restore();
    c.globalCompositeOperation = 'destination-out';
    const p = (f + 1) / 6;
    for (let y = -EC_OY; y < EC_H - EC_OY; y += 2) for (let x = -EC_OX; x < EC_W - EC_OX; x += 2) {
      const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      if ((h % 1000) / 1000 < p) c.fillRect(x, y, 2, 2);
    }
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < f + 2; i++) ecP(c, -8 + ((i * 7) % 16), -30 - f * 4 - i * 3, 1, 1, 'rgba(230,220,255,0.8)');
  } else {
    ecPaint(c, V, an, f);
    if (an === 'hurt') { c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(255,255,255,${[0.75, 0.5, 0.3, 0.1][f]})`; c.fillRect(-EC_OX, -EC_OY, EC_W, EC_H); }
  }
  c.restore();
  if (EC_CACHE.size >= EC_CACHE_MAX) EC_CACHE.delete(EC_CACHE.keys().next().value);
  EC_CACHE.set(key, cv);
  return cv;
}

function gdDrawEcho(c, N) {
  const L = N.look || {}, V = N._ecV && N._ecV.src === L ? N._ecV : (N._ecV = Object.assign(ecLook(L), { src: L }));
  const [an, f] = ecFrame(N);
  c.save();
  c.globalAlpha *= an === 'out' ? 0.85 : 0.8;
  c.drawImage(ecSprite(V, an, f), -EC_OX, -EC_OY);
  c.restore();
  if (N.ename && an !== 'out') {
    c.save();
    const m = c.getTransform && c.getTransform();
    if (m && m.a < 0) c.scale(-1, 1);            // имя не зеркалим, когда призрак смотрит влево
    c.font = '8px sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(220,200,255,0.9)'; c.fillText(N.ename, 0, V.hero ? -44 : -38);
    c.restore();
  }
}
