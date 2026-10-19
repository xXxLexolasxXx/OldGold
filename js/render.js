'use strict';
// Отрисовка кадра: земля, объекты, здания, жители, эффекты, призраки построек.
// Пиксель-арт: целочисленный масштаб, без сглаживания.

const R = {
  canvas: null, ctx: null,
  cam: { x: 0, y: 0, z: 2 },
  hover: null,           // клетка под курсором [x, y]
  hoverPx: null,         // позиция курсора в экранных px
  roadDrag: null,        // клетки, выделенные протяжкой дороги
  smooth: false,         // сглаживание спрайтов (только при сильном отдалении)
  clouds: [],
};

const ZOOMS = [0.5, 1, 2, 3, 4];

// Плотность пикселей холста: на телефонах с экраном ×3 рисуем в ×2 — заметно быстрее.
function screenDPR() { return Math.min(2, window.devicePixelRatio || 1); }

// Физических пикселей холста на пиксель мира: целое при приближении (чёткий пиксель-арт),
// дробное только при сильном отдалении.
function devScale() {
  const zz = R.cam.z * screenDPR();
  return zz >= 1 ? Math.round(zz) : zz;
}

// Сколько CSS-пикселей экрана приходится на пиксель мира.
function camScale() { return devScale() / screenDPR(); }

function initRender(canvas) {
  R.canvas = canvas;
  R.ctx = canvas.getContext('2d');
  const r = mulberry32(4242);
  R.clouds = [];
  for (let k = 0; k < 7; k++) R.clouds.push({
    x: r() * MAP_W * TILE, y: r() * MAP_H * TILE,
    rx: 160 + r() * 220, ry: 90 + r() * 120, v: 6 + r() * 6,
  });
}

function hash(i) { return (Math.imul(i, 2654435761) >>> 0); }

// ---------- Объекты ----------

function drawTree(c, x, y, o, i) {
  const h = hash(i);
  const spr = SPR.trees[h % SPR.trees.length];
  const s = o.g >= 1 ? 1 : 0.35 + 0.55 * o.g;
  const bx = x * TILE + 16 + ((h >>> 4) % 7) - 3, by = y * TILE + 28 + ((h >>> 12) % 5) - 2;
  c.fillStyle = 'rgba(12,18,6,0.35)';
  c.beginPath(); c.ellipse(bx + 6 * s, by - 1, 16 * s, 6 * s, 0, 0, 7); c.fill();
  const w = Math.round(spr.width * s), hh = Math.round(spr.height * s);
  c.drawImage(spr, Math.round(bx - w / 2), Math.round(by - hh * (88 / 92)), w, hh);
}

function drawStoneObj(c, x, y, o, i) {
  const k = Math.max(1, Math.ceil(o.n / 1.6));
  const offs = [[3, 12], [12, 4], [14, 14], [0, 2], [8, 8], [16, 22]];
  for (let j = Math.min(k, offs.length) - 1; j >= 0; j--) {
    const [ox, oy] = offs[j];
    const px = x * TILE + ox - 4, py = y * TILE + oy - 6;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(px + 16, py + 17, 11, 4, 0, 0, 7); c.fill();
    c.drawImage(SPR.boulders[(i + j) % SPR.boulders.length], px, py);
  }
}

function drawStump(c, x, y) {
  const px = x * TILE + 12, py = y * TILE + 18;
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(px + 1, py + 4, 10, 2);
  c.fillStyle = '#24170f'; c.fillRect(px - 1, py, 10, 5);
  c.fillStyle = '#583522'; c.fillRect(px, py + 1, 8, 4);
  c.fillStyle = '#341f14'; c.fillRect(px + 5, py + 1, 3, 4);
  c.fillStyle = '#cc9a64'; c.fillRect(px, py - 1, 8, 2);
  c.fillStyle = '#a06840'; c.fillRect(px + 3, py - 1, 2, 1);
}

// Значок культуры: колос пшеницы или шишка хмеля на шесте — по ним поля узнаются с первого взгляда
function cropGlyph(c, crop, cx, cy, s = 1) {
  c.save(); c.translate(cx, cy); c.scale(s, s);
  if (crop === 'hops') {
    c.strokeStyle = '#4a2c14'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -8); c.stroke();      // шест
    c.strokeStyle = '#4a7a2a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(0, 6); for (let t = 0; t <= 14; t += 2) c.lineTo(Math.sin(t * 0.9) * 2, 6 - t); c.stroke();
    for (const [dx, dy] of [[-2.6, -1], [2.4, -4], [-2.2, -6]]) {
      c.fillStyle = '#6a9a30'; c.beginPath(); c.moveTo(dx, dy - 2.6); c.quadraticCurveTo(dx + 2.4, dy - 0.6, dx, dy + 2.4); c.quadraticCurveTo(dx - 2.4, dy - 0.6, dx, dy - 2.6); c.fill();
      c.fillStyle = '#c8e880'; c.fillRect(dx - 0.5, dy - 1.4, 0.9, 2);
    }
  } else {
    c.strokeStyle = '#c89a30'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 7); c.quadraticCurveTo(1, 0, 0.4, -6); c.stroke();     // стебель
    for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) {
      const y = -6 + k * 2.4;
      c.fillStyle = k % 2 ? '#f0d060' : '#e0b840'; c.beginPath(); c.ellipse(sd * 1.7 + 0.4, y, 0.9, 1.8, sd * 0.5, 0, 7); c.fill();
    }
    c.fillStyle = '#f8e890'; c.beginPath(); c.ellipse(0.4, -8, 0.8, 1.6, 0, 0, 7); c.fill();
  }
  c.restore();
}
const FIELD_COL = { wheat: ['#e8b84a', 'rgba(255,210,90,0.34)'], hops: ['#9ccc50', 'rgba(130,210,90,0.34)'] };

// Заложенное поле: пшеница — борозды проступают рядами, хмель — шесты вбиваются по одному
function drawFieldPlan(c, x, y, o) {
  const px = x * TILE, py = y * TILE, hop = o.crop === 'hops', col = FIELD_COL[hop ? 'hops' : 'wheat'];
  const pr = o.prog || 0;
  c.fillStyle = col[1]; c.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
  if (hop) {
    // шесты, которые уже вбиты, и бечёвка между ними
    const poles = [[6, 30], [16, 30], [26, 30], [6, 16], [16, 16], [26, 16]], n = Math.floor(pr * 6 + 0.001);
    c.fillStyle = 'rgba(80,50,28,0.5)'; for (const [dx, dy] of poles) c.fillRect(px + dx - 1, py + dy - 1, 2, 2);    // метки
    for (let k = 0; k < n; k++) {
      const [dx, dy] = poles[k];
      c.fillStyle = '#4a2c14'; c.fillRect(px + dx - 0.7, py + dy - 11, 1.4, 11);
      c.fillStyle = '#8a5a30'; c.fillRect(px + dx - 0.7, py + dy - 11, 0.5, 11);
      c.fillStyle = '#d8b070'; c.fillRect(px + dx - 1, py + dy - 11.6, 2, 1);
    }
    if (n >= 3) { c.strokeStyle = 'rgba(240,224,180,0.8)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(px + 6, py + 20); c.lineTo(px + 26, py + 20); c.stroke(); }
  } else {
    // борозды: проступают сверху вниз по мере вспашки
    const rows = Math.ceil(pr * 7);
    for (let k = 0; k < 7; k++) {
      const yy = py + 3 + k * 4;
      if (k < rows) { c.fillStyle = '#4a2e16'; c.fillRect(px + 2, yy, TILE - 4, 1.6); c.fillStyle = '#9a7450'; c.fillRect(px + 2, yy + 1.8, TILE - 4, 1); }
      else { c.fillStyle = 'rgba(120,90,50,0.35)'; c.fillRect(px + 2, yy + 1, TILE - 4, 0.8); }
    }
  }
  c.strokeStyle = o.res ? '#fff2a0' : col[0]; c.lineWidth = 1;
  c.setLineDash([3, 3]); c.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5); c.setLineDash([]);
  c.fillStyle = '#6e432a';
  for (const [dx, dy] of [[2, 2], [TILE - 4, 2], [2, TILE - 4], [TILE - 4, TILE - 4]]) c.fillRect(px + dx, py + dy, 2, 4);
  if (pr < 1) { c.globalAlpha = 0.85; cropGlyph(c, o.crop, px + 16, py + 14, 0.8); c.globalAlpha = 1; }
}

function fieldStage(g) {
  if (g < 0) return 0;
  if (g < 0.35) return 1;
  if (g < 1) return 2;
  return 3;
}


// Один удар на действие: замах вверх, удар, инструмент остаётся внизу до следующего
// действия — никакого непрерывного махания по кругу.
function swingFrame(u) {
  const a = u.action;
  // долгое действие (жатва, рубка) — несколько отдельных ударов с паузами, по ~0.9 с на удар
  const n = a && a.T ? Math.max(1, Math.round(a.T / 0.9)) : 1;
  const p = a && a.T ? ((1 - Math.max(0, a.t) / a.T) * n) % 1 : 1;
  // 8 кадров: рука опущена → поднимает (4 кадра) → над плечом → отведена назад → удар → инструмент внизу
  if (p < 0.08) return 4;
  if (p < 0.16) return 3;
  if (p < 0.24) return 2;
  if (p < 0.32) return 1;
  if (p < 0.42) return 0;      // замах над плечом
  if (p < 0.5) return 7;       // чуть назад — разгон
  if (p < 0.54) return 5;      // удар
  if (p < 0.6) return 6;       // инструмент в нижней точке
  return 6;                    // пауза
}

// ---------- Жители ----------

function drawUnit(c, u) {
  let px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6);
  const a = u.action;
  const moving = a && a.walk && a.path && !(a.block > 0 && !a.squeeze) && !(u.pauseUntil > Game.time);
  // вьючная коза и телега извозчика
  if (u.type === 'goat' || u.type === 'carter') {
    drawCreatureAt(c, u.type === 'goat' ? 'packgoat' : 'cart', px, py, u.face, moving, u.walkPhase / 1.4, u.carry, u.carryN || 1, u.type === 'carter' && (u.vdir === 'N' || u.vdir === 'S') ? u.vdir : 'E');
    return;
  }
  let pose = 'idle', frame = 0, view = u.vdir || 'S', face = u.face;
  if (moving) { pose = 'walk'; frame = Math.floor(u.walkPhase / 1.1) & 7; }
  else if (u.anim === 'duck' || u.anim === 'forage') pose = 'duck';
  else if (u.anim === 'smoke') { pose = 'smoke'; view = smokeViewOf(u); }   // кто в анфас (с коротким куревом), кто боком
  else if (u.anim === 'tame') { pose = 'tame'; view = 'E'; }
  else if (u.anim === 'sleep' || u.anim === 'faint' || u.anim === 'knocked' || u.anim === 'fly') { pose = 'idle'; view = 'E'; }
  else if (u.anim === 'sit') { pose = 'duck'; view = 'S'; }
  else if (u.anim === 'lost') { view = 'E'; face = (Math.floor(Game.time * 1.3 + u.id) & 1) ? 1 : -1; }   // озирается в тумане
  else if (u.anim === 'freeze') { view = 'S'; px += (Math.floor(Game.time * 30) & 1) ? 1 : -1; }      // трясётся от ужаса
  else if (u.anim && ANIM_TOOL[u.anim]) { pose = 'work'; view = 'E'; frame = { anim: u.anim, f: swingFrame(u) }; }
  let wp = weatherPose(u);   // скольжение под дождём, горение
  const bw = !wp && u.brawl && typeof brawlPose === 'function' ? brawlPose(u) : null;   // пьяная драка и отлёт героя (brawl.js)
  if (bw) wp = bw;
  if (wp) { pose = wp.pose; view = 'E'; if (wp.frame) frame = wp.frame; }
  if (pose === 'smoke') frame = smokeFrameOf(u);   // 6 кадров курения
  // герой в бою: 9 кадров из people.js (стойка, замах, удар, довод, парирование, удар по нему, победа, выхватывание)
  const ffr = !wp && fightFrameOf(u, moving);
  if (ffr) { pose = 'fight'; view = 'E'; frame = ffr; }
  else if (!wp && !moving && u._wanim && typeof heroWpnFrame === 'function') {   // выхватывает / убирает оружие (герой, рекруты)
    const wf = heroWpnFrame(u);
    if (wf) { pose = 'fight'; view = 'E'; frame = wf; }
  }
  // просто стоит — лицом к зрителю, а не боком, как после ходьбы
  if (pose === 'idle' && !u.anim && !(u.gestUntil > Game.time)) view = 'S';
  // походка и жесты
  const opt = { gait: u.drunkAt ? 'drunk' : u.food <= 0 || u.hangUntil > Game.time ? 'tired' : '', gest: '', gf: gestCyc(Game.time * 4 + u.id) };
  if ((u.type === 'hero' || u.rec || u.gx || u.gm) && typeof heroWpnOf === 'function') opt.wpn = heroWpnOf(u);   // оружие героя, рекрутов и глав гильдий (herokit.js)
  if ((u.anim === 'flaskout' || u.anim === 'drink') && pose === 'idle') {
    opt.gest = u.anim === 'drink' ? 'drink' : 'chest';
    opt.gf = gestCyc(Game.time * 3 + u.id);
    view = (u.id & 1) ? 'S' : 'E';
  } else if (u.gestUntil > Game.time && (pose === 'walk' || pose === 'idle')) {
    opt.gest = u.gest;
    if (u.gest === 'five') { opt.gf = fiveFrameAt(FIVE_T - (u.gestUntil - Game.time)); view = 'E'; face = u.gestFace || face; }
    else if (u.gest === 'clap') { opt.gf = gestCyc(Game.time * 7 + u.id); if (pose === 'idle') view = 'S'; }
    else if (pose === 'idle') { view = 'E'; face = u.gestFace || face; }
  } else if (pose === 'idle' && !u.anim) {
    // заскучал: чешет затылок, потягивается, зевает, оглядывается
    const cyc = Game.time / 7 + u.id * 0.37, p = cyc % 1, n = Math.floor(cyc);
    if (p < 0.24) {
      const k = ['scratch', 'look', 'stretch', 'yawn', 'look'][(n * 7 + u.id * 3) % 5];
      if (k === 'look') { view = 'E'; face = p < 0.12 ? 1 : -1; }
      else opt.gest = k;
    }
  }
  if (opt.gait === 'drunk' && moving) px += Math.round(Math.sin(Game.time * 2.3 + u.id) * 1.6);
  c.fillStyle = 'rgba(10,8,4,0.32)';
  const lying = u.anim === 'sleep' || u.anim === 'faint' || u.anim === 'knocked' || !!(wp && wp.lying);
  if (wp) { px += Math.round(wp.dx); py += Math.round(wp.dy); }
  // отлёт при столкновении: летит назад по дуге, заваливаясь на спину
  let flyP = -1;
  if (u.anim === 'fly' && u.knock && a && a.T) {
    flyP = 1 - Math.max(0, a.t) / a.T;
    px = Math.round((u.knock.x0 + u.knock.dx * flyP) * TILE); py = Math.round((u.knock.y0 + u.knock.dy * flyP) * TILE + 6);
  }
  c.beginPath(); c.ellipse(px + 1.5, py - 0.2, lying ? 10 : 5.5, 2, 0, 0, 7); c.fill();
  if (moving) drawStepDust(c, u, px, py, view);
  if (pose === 'idle' && frame === 0) frame = IDLE_POSE[Math.floor(((Game.time / 2.6 + (u.id || 0) * 0.37) % 1) * IDLE_FRAMES)];   // дыхание: 6 тактов, 2 позы
  // жест и так движется: в покое без дыхания, на ходу — две опорные позы (шаг уже даёт 8 кадров), чтобы не множить спрайты
  if (opt.gest && opt.gest !== 'five') { if (pose === 'idle') frame = 0; else if (pose === 'walk') opt.gf = gestK(opt.gf) >= 0.5 ? 1 : 0; }
  const spr = personSprite(u, view, pose, frame, opt);
  c.imageSmoothingEnabled = R.smooth;   // гномы — пиксель-арт
  if (flyP >= 0) {
    // в полёте: подброшен вверх по дуге и заваливается на спину в сторону отлёта
    const lift = Math.sin(flyP * Math.PI) * 10, back = u.knock.dx >= 0 ? 1 : -1;
    c.save(); c.translate(px, py - lift); c.rotate(flyP * Math.PI / 2 * 0.95 * back);
    if (face < 0) c.scale(-1, 1);
    c.drawImage(spr, -PFX, -PFY, PW, PH);
    c.restore();
  } else if (wp) {
    // особая поза: летит, скользит, лежит, катается, поднимается
    c.save(); c.translate(px, py - (wp.off ? 1 : 0) - wp.lift); c.rotate(wp.rot);
    if (u.face < 0) c.scale(-1, 1);
    if (wp.rollA !== undefined) c.scale(Math.cos(wp.rollA), 1);   // вращение вокруг продольной оси: спина → живот
    c.drawImage(spr, -PFX, -PFY + wp.off, PW, PH);
    c.restore();
  } else if (lying) {
    // лежит на земле: пьяный бормочет «Zzz», голодный — без сил, кружатся «звёздочки»
    c.save(); c.translate(px, py - 1); c.rotate(-Math.PI / 2 * (u.face < 0 ? -1 : 1));
    if (u.face < 0) c.scale(-1, 1);
    c.drawImage(spr, -PFX, -PFY + 2, PW, PH);
    c.restore();
    const t = Game.time;
    if (u.anim === 'sleep') {
      c.fillStyle = 'rgba(240,240,255,0.9)'; c.font = 'bold 6px serif';
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.5 + k / 3) % 1;
        c.globalAlpha = 1 - p;
        c.fillText('z', px + 6 + p * 8, py - 10 - p * 14 - k);
      }
      c.globalAlpha = 1;
    } else if (u.anim === 'faint') {
      // урчит пустой живот: пустая миска над головой и кружок слабости
      for (let k = 0; k < 3; k++) {
        const a = t * 3 + k * 2.1;
        c.fillStyle = '#d8c8a0'; c.fillRect(Math.round(px + Math.cos(a) * 5), Math.round(py - 9 + Math.sin(a) * 1.5), 1, 1);
      }
      c.fillStyle = '#6e432a'; c.beginPath(); c.ellipse(px, py - 14, 3.2, 1.6, 0, 0, Math.PI); c.fill();
      c.fillStyle = '#3a2414'; c.fillRect(px - 3.2, py - 14.4, 6.4, 0.8);
    }
  } else if (view === 'E' && face < 0) {
    c.save(); c.translate(px, 0); c.scale(-1, 1);
    c.drawImage(spr, -PFX, py - PFY, PW, PH);
    c.restore();
  } else c.drawImage(spr, px - PFX, py - PFY, PW, PH);
  c.imageSmoothingEnabled = R.smooth;
  drawUnitFx(c, u, px, py, moving);
  if (bw && typeof brawlFx === 'function') brawlFx(c, u, bw, px, py);
  drawNightUnit(c, u, px, py, face, view, lying || flyP >= 0);
  if (u.netUntil > Game.time && !lying) drawNet(c, u, px, py, face, moving);
  if (!wp) drawUmbrella(c, u, px, py, face, pose, lying);
  if (u.noseUntil > Game.time && !lying) drawRedNose(c, u, px, py, view, face);
  // трубка или сигарета в руке и дымок (smoking.js)
  if ((u.anim === 'smoke' || u.anim === 'smokeup') && pose === 'smoke') drawSmoking(c, u, px, py, view);
  if (u.food <= 0) {
    c.fillStyle = '#160e0a'; c.fillRect(px + 4, py - 36, 4, 8);
    c.fillStyle = '#e04030'; c.fillRect(px + 5, py - 35, 2, 4); c.fillRect(px + 5, py - 30, 2, 1);
  }
}

// Из-под ног: пыль на дороге и песке, травинки на лугу. Каждый шаг — новый клубок.
function drawStepDust(c, u, px, py, view) {
  const t = u.walkPhase / 1.1 / 4, p = t % 1, k = Math.floor(t);
  if (p > 0.7) return;
  const i = idx(Math.floor(u.x), Math.floor(u.y));
  const back = view === 'E' ? -u.face : 0;
  const fx = px + back * (2 + p * 3) + (k & 1 ? 1.5 : -1.5), fy = py - 0.5;
  const a = 1 - p / 0.7;
  const ter = World.terrain[i];
  if (World.road[i] || ter === T_SAND) {
    c.fillStyle = `rgba(214,196,150,${0.45 * a})`;
    for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(fx + (j - 1) * 1.6 * (1 + p), fy - p * 2.4 - (j & 1), 0.7 + p * 1.6, 0, 7); c.fill(); }
  } else if (ter === T_GRASS) {
    c.fillStyle = `rgba(150,200,90,${0.8 * a})`;
    for (let j = 0; j < 2; j++) c.fillRect(Math.round(fx + (j ? 1.4 : -1.2) * (1 + p * 2)), Math.round(fy - 1 - p * 3 + j), 1, 1);
  }
}

// Над головой: пот под тяжёлой ношей, звёздочки после столкновения, «ик» у пьяного.
function drawUnitFx(c, u, px, py, moving) {
  const t = Game.time;
  if (moving && u.carry && HEAVY.has(u.carry) && u.type !== 'serf') {
    const p = (t * 0.8 + u.id * 0.3) % 1;
    if (p < 0.6) {
      c.fillStyle = `rgba(150,200,255,${0.9 * (1 - p / 0.6)})`;
      c.fillRect(Math.round(px + 5 * (u.face || 1)), Math.round(py - 24 + p * 6), 1, 2);
    }
  }
  if (u.ouchUntil > t) {
    for (let k = 0; k < 3; k++) {
      const a = t * 5 + k * 2.1;
      c.fillStyle = k === 1 ? '#fff4a0' : '#ffd040';
      const sx = Math.round(px + Math.cos(a) * 5.5), sy = Math.round(py - 31 + Math.sin(a) * 1.6);
      c.fillRect(sx, sy - 1, 1, 3); c.fillRect(sx - 1, sy, 3, 1);
    }
  }
  if (u.drunkAt && !u.inside) {
    const p = (t * 0.4 + u.id * 0.21) % 1;
    if (p < 0.35) {
      c.globalAlpha = 1 - p / 0.35;
      c.fillStyle = '#fff6d0'; c.font = 'bold 5px serif';
      c.fillText('ик!', px + 5, py - 30 - p * 10);
      c.globalAlpha = 1;
    }
  }
}

// Стройка дороги: колышки с бечёвкой → корыто растёт с каждым взмахом лопаты
// (земля в отвал) → булыжник ложится рядами с каждым ударом молотка.
// Корыто дороги повторяет форму будущей мостовой: круг в клетке, перемычки к соседям
// (готовая дорога или другая стройка) и косые ленты к диагональным соседям
function isRoadOrSite(x, y) { return inb(x, y) && (World.road[idx(x, y)] || Game.roadSites.has(idx(x, y))); }
function siteShape(c, s, k) {
  const px = s.x * TILE, py = s.y * TILE, cx = px + TILE / 2, cy = py + TILE / 2, w = (11.5) * (0.45 + 0.55 * k);
  c.beginPath();
  c.arc(cx, cy, w, 0, Math.PI * 2);
  if (isRoadOrSite(s.x - 1, s.y)) c.rect(px, cy - w, TILE / 2, w * 2);
  if (isRoadOrSite(s.x + 1, s.y)) c.rect(cx, cy - w, TILE / 2, w * 2);
  if (isRoadOrSite(s.x, s.y - 1)) c.rect(cx - w, py, w * 2, TILE / 2);
  if (isRoadOrSite(s.x, s.y + 1)) c.rect(cx - w, cy, w * 2, TILE / 2);
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    if (!isRoadOrSite(s.x + dx, s.y + dy) || isRoadOrSite(s.x + dx, s.y) || isRoadOrSite(s.x, s.y + dy)) continue;
    // половина ленты до угла клетки: вторая половина дорисуется в соседней клетке
    const x1 = cx + dx * TILE / 2, y1 = cy + dy * TILE / 2, L = Math.SQRT2 * TILE / 2;
    const nx = -(dy) / Math.SQRT2 * w, ny = dx / Math.SQRT2 * w;
    pathPolyCW(c, [[cx + nx, cy + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [cx - nx, cy - ny]]);
    void L;
  }
}

function drawRoadSite(c, s) {
  const px = s.x * TILE, py = s.y * TILE;
  const x0 = px + 5, y0 = py + 5, w = 22, h = 22;
  // колышки и бечёвка
  c.fillStyle = '#6e432a';
  for (const [x, y] of [[x0 - 1, y0 - 3], [x0 + w - 1, y0 - 3], [x0 - 1, y0 + h - 3], [x0 + w - 1, y0 + h - 3]]) c.fillRect(x, y, 2, 4);
  c.fillStyle = 'rgba(240,214,168,0.8)';
  c.fillRect(x0, y0 - 2, w, 1); c.fillRect(x0, y0 + h - 2, w, 1);
  if (s.dug > 0) {
    // корыто: тёмная влажная земля, растёт к центру
    const k = s.dug;
    // корыто: тёмная влажная земля той же формы, что и будущая дорога
    siteShape(c, s, k + 0.25);
    c.fillStyle = '#24170f'; c.fill();
    siteShape(c, s, k * 0.92);
    c.fillStyle = '#45291a'; c.fill();
    // отвал земли сбоку
    const mx = px + 27, my = py + 24, ms = 2 + k * 3;
    c.fillStyle = '#583522'; c.beginPath(); c.ellipse(mx, my, ms + 1, ms * 0.7, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#875434'; c.fillRect(mx - ms * 0.5, my - ms * 0.6, ms * 0.5, 1);
    if (s.pave > 0) {
      c.save(); siteShape(c, s, k * 0.92); c.clip();
      paveCobbles(c, px - 4, py - 4, TILE + 8, TILE + 8, s.pave);
      c.restore();
    }
  }
  // привезённый камень лежит у края
  if (s.stock.stone > 0 && s.pave < 1) {
    c.fillStyle = '#706960'; c.fillRect(px + 2, py + 22, 6, 5);
    c.fillStyle = '#b6ada0'; c.fillRect(px + 2, py + 22, 6, 1); c.fillRect(px + 4, py + 20, 3, 2);
  }
  // пыль/земля из-под удара
  if (Game.time - s.lastHit < 0.35) {
    const a = 1 - (Game.time - s.lastHit) / 0.35;
    c.fillStyle = s.pave > 0 ? `rgba(200,195,180,${0.7 * a})` : `rgba(120,80,40,${0.8 * a})`;
    for (let k = 0; k < 4; k++) c.fillRect(px + 12 + k * 3 - a * 2, py + 14 - (1 - a) * 6 - (k & 1) * 2, 2, 2);
  }
}

// Рассыпанный груз на земле
function drawPile(c, p) {
  const x = p.x * TILE + 16, y = p.y * TILE + 22;
  c.imageSmoothingEnabled = true;
  let k = 0;
  for (const g of GOOD_KEYS) for (let n = 0; n < Math.min(p.stock[g], 3); n++, k++) {
    c.save(); c.translate(x - 6 + (k % 3) * 6, y - Math.floor(k / 3) * 4); c.scale(0.7, 0.7);
    drawLoad(c, g);
    c.restore();
  }
  c.imageSmoothingEnabled = R.smooth;
}

// ---------- Животные ----------

const PIG_SPR = [];
function pigSprite(f) {
  if (PIG_SPR[f]) return PIG_SPR[f];
  const cv = mkCanvas(14, 10), c = cv.getContext('2d');
  px(c, 2, 2, 9, 5, '#eeaab2'); px(c, 3, 1, 7, 1, '#eeaab2'); px(c, 2, 6, 9, 1, '#d0808e');
  px(c, 10, 3, 3, 3, '#d0808e'); px(c, 12, 4, 1, 1, '#7a3a4a'); px(c, 9, 1, 2, 2, '#d0808e');
  px(c, 9, 3, 1, 1, '#160e0a'); px(c, 1, 2, 1, 2, '#d0808e');
  const l = f ? 1 : 0;
  px(c, 3 + l, 7, 2, 2, '#a85a6a'); px(c, 8 - l, 7, 2, 2, '#a85a6a');
  finishPixel(cv, true);
  PIG_SPR[f] = cv;
  return cv;
}

// Свинья: size 1/3, 2/3 или 3/3 взрослой.
const PIG_CACHE = {};
function pigSpriteHR(stage, f) {
  const key = stage + '_' + f;
  if (PIG_CACHE[key]) return PIG_CACHE[key];
  const s = [0.55, 0.75, 1][stage - 1];
  const [cv, c] = mkSprite(24, 16, 3);
  c.translate(12, 13); c.scale(s, s);
  const body = '#eaa8a8', dark = '#c07878';
  const leg = f ? 1 : -1;
  for (const [lx, d] of [[-5, leg], [-2, -leg], [3, leg], [6, -leg]]) { c.fillStyle = dark; c.fillRect(lx + d * 0.5, -2, 1.6, 3); c.fillStyle = '#5a3030'; c.fillRect(lx + d * 0.5, 0.6, 1.6, 0.7); }
  c.fillStyle = lingrad(c, 0, -10, 0, -1, [[0, '#f6c8c4'], [0.5, body], [1, dark]]);
  c.beginPath(); c.ellipse(0, -5, 8.5, 4.6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = body; c.beginPath(); c.ellipse(7.5, -6, 3.6, 3.3, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d88a8a'; c.beginPath(); c.ellipse(10.6, -5.4, 1.4, 1.6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#7a3a3a'; c.fillRect(10.6, -6, 0.5, 0.5); c.fillRect(10.6, -4.8, 0.5, 0.5);
  c.fillStyle = '#1a0a0a'; c.fillRect(8.4, -7.4, 0.8, 0.8);
  c.fillStyle = dark; c.beginPath(); c.moveTo(6, -8.6); c.lineTo(7.6, -11); c.lineTo(8.6, -8.4); c.fill();
  c.strokeStyle = dark; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-8.4, -6); c.quadraticCurveTo(-10.5, -8, -9, -9); c.stroke();
  c.fillStyle = 'rgba(110,70,40,0.35)'; c.beginPath(); c.ellipse(-2, -2.4, 4, 1.4, 0, 0, Math.PI * 2); c.fill();
  PIG_CACHE[key] = cv;
  return cv;
}

function drawPigs(c, b, spr, ox, oy) {
  const q = spr.penQuad;
  const pigs = [];
  for (let k = 0; k < b.stock.pig; k++) pigs.push(3);
  for (const s of b.pigs) pigs.push(s);
  pigs.forEach((stage, k) => {
    const t = Game.time * 0.22 + k * 2.3 + b.id;
    const fx = (Math.sin(t) * 0.5 + 0.5), fy = (Math.cos(t * 0.7 + k * 1.7) * 0.5 + 0.5);
    // позиция внутри загона: билинейно по углам четырёхугольника (с отступом под размер свиньи)
    const u = 0.06 + fx * 0.88, v = 0.08 + fy * 0.84;
    const x = ox + q[0][0] + u * (q[1][0] - q[0][0]) + v * (q[2][0] - q[0][0]) - 12, y = oy + q[0][1] + u * (q[1][1] - q[0][1]) + v * (q[2][1] - q[0][1]) - 14;
    const dir = Math.cos(t) >= 0 ? 1 : -1;
    const moving = Math.abs(Math.cos(t)) > 0.25;
    const s = pigSpriteHR(stage, moving ? Math.floor(Game.time * 5 + k) & 1 : 0);
    c.fillStyle = 'rgba(10,8,4,0.3)';
    c.beginPath(); c.ellipse(x + 13, y + 13, 7 * [0.55, 0.75, 1][stage - 1], 2, 0, 0, 7); c.fill();
    if (dir < 0) { c.save(); c.translate(x + 24, y); c.scale(-1, 1); c.drawImage(s, 0, 0, 24, 16); c.restore(); }
    else c.drawImage(s, x, y, 24, 16);
  });
}

// ---------- Здания ----------

function drawBuilding(c, b, ghost) {
  if (b.eraFx && Game.time - b.eraFx.t0 > ERA_FX.dur) b.eraFx = null;   // перестройка кончилась, пока здание было за кадром
  const eraFx = !ghost && b.eraFx && !b.upg && b.state === 'done';
  const spr = buildingSprite(b.type, b.rot || 0, b.level, eraFx ? b.eraFx.from : undefined);
  const ox = b.x * TILE - spr.padx, oy = b.y * TILE - spr.top;
  const fx = b.x * TILE, fy = b.y * TILE, fw = b.w * TILE, fh = b.h * TILE;
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  if (!ghost && b.selfBuild && b.state === 'build') { drawSelfBuild(c, b); return; }
  if (!ghost && b.state !== 'done') {
    drawSite(c, b, spr, ox, oy, fx, fy, fw, fh);
    c.imageSmoothingEnabled = R.smooth;
    return;
  }
  c.drawImage(spr.shadow, ox, oy, spr.w, spr.h);
  c.drawImage(spr.canvas, ox, oy, spr.w, spr.h);
  if (eraFx) eraDrawFx(c, b, spr, ox, oy);
  if (!ghost && b.upg) drawUpgradeLayer(c, b);
  if (!ghost && b.dmg > 0) drawDamage(c, b, ox, oy, spr);
  const t = Game.time;
  if (b.type === 'mill' && spr.hub) drawSails(c, ox + spr.hub[0], oy + spr.hub[1], b.anim);
  if (spr.pen && b.stock) drawPigs(c, b, spr, ox, oy);
  c.imageSmoothingEnabled = R.smooth;
  if (spr.chimneys && (b.working || b.type === 'inn' || b.type === 'farm' || ghost))
    for (const [sx, sy] of spr.chimneys) drawSmoke(c, ox + sx, oy + sy, b.id + sx, b.working ? 1 : 0.5);
  if (spr.glow && (b.working || b.type === 'crystalmine')) {
    const gx = ox + spr.glow[0], gy = oy + spr.glow[1];
    const a = (b.working ? 0.35 : 0.2) + 0.12 * Math.sin(t * 7) + 0.08 * Math.sin(t * 19);
    glow(c, gx, gy, 18, spr.glowColor || '255,160,60', a);
    if (!spr.glowColor && b.working) drawFire(c, gx, gy + 3, 'spark', t, b.id, { glow: 0, sparks: 2 });
  }
  if (spr.fire && b.state === 'done') drawBonfireFlames(c, ox + spr.fire[0], oy + spr.fire[1], b.working || b.stock.trash > 0, b.id);
  if (spr.circle) {
    const [cx, cy] = spr.circle;
    const pulse = 0.5 + 0.5 * Math.sin(t * (b.working ? 3 : 1));
    glow(c, ox + cx, oy + cy, b.working ? 46 : 26, '150,100,255', (b.working ? 0.32 : 0.14) + pulse * 0.12);
    if (b.working) {
      for (let k = 0; k < 10; k++) {
        const p = (t * 0.5 + k / 10) % 1;
        const a = k / 10 * Math.PI * 2 + t * 0.4;
        const sx = ox + cx + Math.cos(a) * 30 * (1 - p), sy = oy + cy + 14 + Math.sin(a) * 22 * (1 - p) - p * 26;
        c.fillStyle = k % 2 ? '#bea4f6' : '#e2d6ff';
        c.globalAlpha = 1 - p;
        c.fillRect(Math.round(sx), Math.round(sy), 2, 2);
      }
      c.globalAlpha = 1;
    }
  }
  if (spr.cauldron && b.working) {
    const [cx, cy] = spr.cauldron;
    glow(c, ox + cx, oy + cy, 12, '140,90,255', 0.3);
    for (let k = 0; k < 4; k++) {
      const p = (t * 0.8 + k / 4) % 1;
      c.globalAlpha = 1 - p;
      c.fillStyle = '#9c7ae6';
      c.fillRect(Math.round(ox + cx - 3 + k * 2 + Math.sin(p * 6 + k) * 1.5), Math.round(oy + cy - 2 - p * 12), 2, 2);
    }
    c.globalAlpha = 1;
  }
  if (!ghost) drawInside(c, b, spr, ox, oy);   // силуэты в окнах, веранда трактира (inside.js)
}

// Ореол: радиальный градиент один раз рисуется на офскрин-канвас (кэш по цвету и радиусу), дальше drawImage с globalAlpha
const _glowCache = new Map();
function glow(c, x, y, r, rgb, a) {
  const R = Math.max(2, Math.round(r)), key = rgb + '|' + R;
  let s = _glowCache.get(key);
  if (!s) {
    s = document.createElement('canvas'); s.width = s.height = R * 2;
    const k = s.getContext('2d'), g = k.createRadialGradient(R, R, 1, R, R, R);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    k.fillStyle = g; k.fillRect(0, 0, R * 2, R * 2);
    _glowCache.set(key, s);
  }
  const pa = c.globalAlpha;
  c.globalAlpha = pa * a;
  c.drawImage(s, x - R, y - R);
  c.globalAlpha = pa;
}

// Клетки 4×4 спрайта здания в порядке «снизу вверх, ряд за рядом» — по ним идёт стройка.
function siteCells(spr) {
  if (spr.cells) return spr.cells;
  const cv = spr.canvas, k = cv.width / spr.w, cs = Math.round(4 * k);
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const cols = Math.ceil(cv.width / cs), rows = Math.ceil(cv.height / cs);
  const r = mulberry32(7), cells = [];
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let n = 0;
    for (let y = cy * cs; y < Math.min(cv.height, (cy + 1) * cs); y += 2)
      for (let x = cx * cs; x < Math.min(cv.width, (cx + 1) * cs); x += 2)
        if (d[(y * cv.width + x) * 4 + 3] > 30) n++;
    if (n) cells.push({ x: cx * cs, y: cy * cs, s: cs, key: (rows - cy) + r() * 1.8 });
  }
  cells.sort((a, b) => a.key - b.key);
  spr.cells = cells;
  return cells;
}

// Холст стройки здания: на каждый удар молота дорисовываем порцию клеток.
function siteState(b, spr) {
  const cells = siteCells(spr);
  if (!b._site || b._site.spr !== spr) b._site = { spr, cv: mkCanvas(spr.canvas.width, spr.canvas.height), n: 0, pops: [], top: 1e9 };
  const S = b._site;
  const target = Math.floor(b.buildFrac * cells.length);
  if (S.n < target) {
    const sc = S.cv.getContext('2d');
    const fresh = S.n > 0;     // при загрузке игры не мигаем всем зданием
    let k = 0;
    while (S.n < target) {
      const cl = cells[S.n++];
      sc.drawImage(spr.canvas, cl.x, cl.y, cl.s, cl.s, cl.x, cl.y, cl.s, cl.s);
      S.top = Math.min(S.top, cl.y);
      if (fresh) S.pops.push({ cl, t: Game.time, dust: k++ % 9 === 0 });
    }
    if (S.pops.length > 160) S.pops.splice(0, S.pops.length - 160);
  }
  return S;
}

function drawSite(c, b, spr, ox, oy, fx, fy, fw, fh) {
  c.fillStyle = '#45291a'; c.fillRect(fx + 1, fy + 1, fw - 2, fh - 2);
  c.fillStyle = '#875434'; c.fillRect(fx + 2, fy + 2, fw - 4, fh - 4);
  const r = mulberry32(b.id);
  for (let k = 0; k < fw * fh / 30; k++) {
    c.fillStyle = r() < 0.5 ? '#6e432a' : '#a06840';
    c.fillRect(fx + 2 + ((r() * (fw - 6)) | 0), fy + 2 + ((r() * (fh - 6)) | 0), 2, 1);
  }
  // колышки забиваются по одному на каждый удар разметки
  const stakes = [[fx + 3, fy + 3], [fx + fw - 5, fy + 3], [fx + 3, fy + fh - 5], [fx + fw - 5, fy + fh - 5]];
  const nStakes = b.state === 'site' ? Math.min(4, 1 + b.hits) : 4;
  for (const [sx, sy] of stakes.slice(0, nStakes)) {
    c.fillStyle = '#583522'; c.fillRect(sx, sy - 6, 2, 7);
    c.fillStyle = '#e0b882'; c.fillRect(sx, sy - 6, 2, 1);
  }
  // верёвка разметки
  c.fillStyle = '#e4ddd2';
  c.fillRect(fx + 4, fy + 3, fw - 8, 1); c.fillRect(fx + 4, fy + fh - 4, fw - 8, 1);
  if (b.state === 'build') {
    c.imageSmoothingEnabled = true;
    const S = siteState(b, spr);
    c.globalAlpha = Math.min(1, b.buildFrac * 1.5);
    c.drawImage(spr.shadow, ox, oy, spr.w, spr.h);
    c.globalAlpha = 1;
    c.drawImage(S.cv, ox, oy, spr.w, spr.h);
    // вспышка и пыль там, куда лёг новый «кирпичик»
    const k = spr.canvas.width / spr.w;
    for (const p of S.pops) {
      const age = Game.time - p.t;
      if (age > 0.6) continue;
      const cl = p.cl, x = ox + cl.x / k, y = oy + cl.y / k, s = cl.s / k;
      if (age < 0.3) { c.fillStyle = `rgba(255,248,225,${0.55 * (1 - age / 0.3)})`; c.fillRect(x, y, s, s); }
      if (p.dust) {
        c.fillStyle = `rgba(200,180,150,${0.5 * (1 - age / 0.6)})`;
        for (let d = 0; d < 4; d++) {
          const a = d * 1.6 + cl.x;
          c.beginPath(); c.arc(x + s / 2 + Math.cos(a) * age * 14, y + s / 2 + Math.sin(a) * age * 8 - age * 6, 1 + age * 4, 0, 7); c.fill();
        }
      }
    }
    c.imageSmoothingEnabled = R.smooth;
    // строительные леса до текущей высоты
    const topY = S.top < 1e9 ? oy + S.top / k : fy + fh - 10;
    const poleTop = Math.min(fy + fh - 10, topY - 5);
    for (let q = 0; q <= b.w; q++) {
      const lx = Math.round(fx + 2 + q * (fw - 6) / b.w);
      c.fillStyle = '#583522'; c.fillRect(lx, poleTop, 2, fy + fh - poleTop);
      c.fillStyle = '#a06840'; c.fillRect(lx, poleTop, 1, fy + fh - poleTop);
    }
    for (let ly = fy + fh - 12; ly > poleTop + 2; ly -= 12) {
      c.fillStyle = '#45291a'; c.fillRect(fx, ly + 2, fw, 1);
      c.fillStyle = '#cc9a64'; c.fillRect(fx, ly, fw, 2);
    }
  }
  let mx = fx + 4;
  const my = fy + fh - 3;
  for (let k = 0; k < b.stock.trunk; k++, mx += 7) {
    c.fillStyle = '#2e1a0a'; c.fillRect(mx - 1, my - 4, 8, 5);
    c.fillStyle = '#7a4a22'; c.fillRect(mx, my - 3, 6, 3); c.fillStyle = '#a06a3a'; c.fillRect(mx, my - 3, 6, 1);
  }
  for (let k = 0; k < b.stock.timber; k++, mx += 6) {
    c.fillStyle = '#583522'; c.fillRect(mx - 1, my - 5, 7, 6);
    c.fillStyle = '#cc9a64'; c.fillRect(mx, my - 4, 5, 4);
    c.fillStyle = '#a06840'; c.fillRect(mx, my - 2, 5, 1);
  }
  for (let k = 0; k < b.stock.stone; k++, mx += 6) {
    c.fillStyle = '#3a3632'; c.fillRect(mx - 1, my - 5, 7, 6);
    c.fillStyle = '#9e958a'; c.fillRect(mx, my - 4, 5, 4);
    c.fillStyle = '#cec6ba'; c.fillRect(mx, my - 4, 5, 1);
  }
}

function drawSails(c, x, y, a) {
  // пиксельные кадры: крылья симметричны, поэтому достаточно четверти оборота
  const q = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
  const spr = sailFrame(Math.floor(q / (Math.PI / 2) * SAIL_FRAMES) % SAIL_FRAMES);
  const prev = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false;
  c.drawImage(spr, Math.round(x - SAIL_SIZE / 2), Math.round(y - SAIL_SIZE / 2), SAIL_SIZE, SAIL_SIZE);
  c.imageSmoothingEnabled = prev;
}

function drawSailsOld(c, x, y, a) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  for (let k = 0; k < 4; k++) {
    c.rotate(Math.PI / 2);
    c.fillStyle = '#24170f'; c.fillRect(-1.5, 0, 3, 34);
    c.fillStyle = '#583522'; c.fillRect(-1, 0, 2, 33);
    c.fillStyle = '#341f14'; c.fillRect(0.5, 6, 9.5, 27);
    c.fillStyle = '#e4ddd2'; c.fillRect(1.5, 7, 7.5, 25);
    c.fillStyle = '#b6ada0'; c.fillRect(5, 7, 4, 25);
    c.fillStyle = '#583522';
    for (let s = 11; s < 32; s += 4) c.fillRect(1.5, s, 7.5, 1);
    c.fillRect(4.5, 7, 1, 25);
  }
  c.fillStyle = '#24170f'; c.fillRect(-3, -3, 6, 6);
  c.fillStyle = '#875434'; c.fillRect(-2, -2, 3, 3);
  c.restore();
}

function drawSmoke(c, x, y, seed, amount) {
  for (let k = 0; k < 6; k++) {
    const t = (Game.time * 0.35 + k / 6 + seed * 0.13) % 1;
    const px = x + Math.sin(t * 4 + seed) * 3 + t * 14, py = y - t * 38;
    const r = Math.round(2 + t * 6);
    c.globalAlpha = 0.55 * (1 - t) * amount;
    c.fillStyle = '#b6ada0';
    c.fillRect(Math.round(px - r), Math.round(py - r + 1), r * 2, r * 2 - 2);
    c.fillRect(Math.round(px - r + 1), Math.round(py - r), r * 2 - 2, r * 2);
    c.fillStyle = '#e4ddd2';
    c.fillRect(Math.round(px - r + 1), Math.round(py - r + 1), r, r);
  }
  c.globalAlpha = 1;
}

// ---------- Эффекты ----------

function drawWaterSparkles(c, x0, y0, x1, y1) {
  const t = Game.time;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y);
    const ter = World.terrain[i];
    if (ter === T_WATER) {
      const h = hash(i + 99);
      for (let k = 0; k < 2; k++) {
        const hh = h >>> (k * 8);
        const s = Math.sin(t * (0.8 + (hh % 7) / 10) + (hh % 628) / 100);
        if (s < 0.7) continue;
        const sx = x * TILE + (hh % 24) + 4, sy = y * TILE + ((hh >>> 5) % 26) + 3;
        c.fillStyle = s > 0.9 ? '#d6eef6' : '#76b2d4';
        c.fillRect(sx - 2, sy, 5, 1);
        if (s > 0.9) c.fillRect(sx, sy - 1, 1, 1);
      }
    } else if (ter === T_ROCK && World.crystal[i]) {
      const h = hash(i + 7);
      const s = Math.sin(t * 2 + (h % 628) / 100);
      glow(c, x * TILE + 16, y * TILE + 22, 16, '150,100,255', 0.12 + 0.06 * s);
      if (s > 0.8) {
        const sx = x * TILE + 6 + (h % 20), sy = y * TILE + 10 + ((h >>> 6) % 14);
        c.fillStyle = '#ffffff';
        c.fillRect(sx, sy - 1, 1, 3); c.fillRect(sx - 1, sy, 3, 1);
      }
    }
  }
}

function drawClouds(c) {
  const W = MAP_W * TILE;
  for (const cl of R.clouds) {
    const x = ((cl.x + Game.time * cl.v) % (W + 800)) - 400, y = cl.y;
    c.save();
    c.translate(x, y);
    c.scale(1, cl.ry / cl.rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, cl.rx);
    g.addColorStop(0, 'rgba(20,30,50,0.16)');
    g.addColorStop(0.6, 'rgba(20,30,50,0.08)');
    g.addColorStop(1, 'rgba(20,30,50,0)');
    c.fillStyle = g;
    c.fillRect(-cl.rx, -cl.rx, cl.rx * 2, cl.rx * 2);
    c.restore();
  }
}

// Значки проблем над зданиями
function drawStatusIcons(c, x0, y0, x1, y1) {
  for (const b of Game.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y > y1 || b.y < y0 - 3) continue;
    let icon = null;
    if (b.state !== 'done') {
      if (b.problem() === 'noroad') icon = ['ui', 'road'];
      else if (!b.builder) icon = ['ui', 'noworker'];
    } else {
      const p = b.problem();
      if (!p && b.noDeliver) icon = ['ui', 'nodeliver'];
      else if (!p) continue;
      else if (p === 'noroad') icon = ['ui', 'road'];
      else if (p === 'damaged') icon = ['ui', 'warn'];
      else if (p === 'paused') icon = ['ui', 'pause'];
      else if (p === 'noworker') icon = ['ui', 'noworker'];
      else if (p === 'full') icon = ['ui', 'full'];
      else if (p.startsWith('need:')) icon = ['good', p.slice(5)];
    }
    if (!icon) continue;
    const bob = Math.round(Math.sin(Game.time * 3 + b.id) * 1.5);
    const ix = b.x * TILE + Math.round(b.w * TILE / 2) - 11, iy = b.y * TILE - 34 + bob;
    c.fillStyle = '#160e0a'; c.fillRect(ix, iy, 22, 22);
    c.fillStyle = icon[1] === 'pause' ? '#45291a' : '#6a2018'; c.fillRect(ix + 1, iy + 1, 20, 20);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(ix + 1, iy + 1, 20, 1);
    c.fillStyle = '#160e0a'; c.fillRect(ix + 9, iy + 22, 4, 2); c.fillRect(ix + 10, iy + 24, 2, 1);
    c.drawImage(iconCanvas(icon[0], icon[1]), ix + 2, iy + 2);
  }
}

// ---------- Кадр ----------

function render() {
  R.newSprites = 0;
  const { ctx: c, cam, canvas } = R;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#100c08';
  c.fillRect(0, 0, canvas.width, canvas.height);
  const z = devScale();
  R.smooth = z < 1;          // сильно отдалено — сглаживаем, чтобы пиксель-арт не рябил
  c.setTransform(z, 0, 0, z, -Math.round(cam.x * z), -Math.round(cam.y * z));
  c.imageSmoothingEnabled = R.smooth;
  terrDraw(c, cam, canvas.width / z, canvas.height / z);

  const vw = canvas.width / z, vh = canvas.height / z;
  const x0 = Math.max(0, Math.floor(cam.x / TILE) - 2), y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const x1 = Math.min(MAP_W - 1, Math.ceil((cam.x + vw) / TILE) + 2), y1 = Math.min(MAP_H - 1, Math.ceil((cam.y + vh) / TILE) + 4);

  drawWaterSparkles(c, x0, y0, x1, y1);

  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = World.obj[idx(x, y)];
    if (o && o.t === 'field') {
      if (o.plan) drawFieldPlan(c, x, y, o); else c.drawImage(SPR.fields[o.crop || 'wheat'][fieldStage(o.g)], x * TILE, y * TILE);
      if (o.ash) {   // удобрено пеплом: серые крапинки в бороздах
        c.fillStyle = 'rgba(200,195,185,0.75)';
        for (let k = 0; k < 7; k++) c.fillRect(x * TILE + 3 + ((k * 13 + x * 7) % 26), y * TILE + 4 + ((k * 7 + y * 5) % 24), 1, 1);
      }
    }
  }
  for (const s of Game.roadSites.values()) drawRoadSite(c, s);
  drawGamesGround(c, x0, y0, x1, y1);      // чертёж, карты и круг ножичков на земле (games.js)

  const list = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y), o = World.obj[i];
    if (!o) continue;
    if (o.t === 'tree') { if (!o.awake) list.push([y + 0.9, () => drawTree(c, x, y, o, i)]); }   // проснувшееся рисуется само
    else if (o.t === 'log') list.push([y + 0.7, () => drawLog(c, x, y)]);
    else if (o.t === 'stone') { if (!o.awake) list.push([y + 0.8, () => drawRock(c, x, y, o, i)]); }   // проснувшийся рисуется сам
    else if (isStreetObj(o)) list.push([y + 0.75, () => drawStreetObj(c, x, y, o)]);
    else if (o.t === 'stump') list.push([y + 0.7, () => drawStump(c, x, y)]);
    else if (o.t === 'hop') list.push([y + 0.01, () => drawHopObj(c, x, y, o)]);       // классики мелом на дороге (games.js)
  }
  // горы: объёмные скальные массивы по глубине вместе с остальными объектами
  for (const m of MOUNTS) {
    const S = MT_SIZES[m.size], ty = m.y / TILE;
    if (ty < y0 - 1 || ty - 5 > y1 || m.x + S.w / 2 < cam.x || m.x - S.w / 2 > cam.x + vw) continue;
    list.push([ty + 0.12, () => drawMountain(c, m)]);
  }
  // кристаллы на скале — выше гор, чтобы было видно, где ставить шахту
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y);
    if (World.crystal[i] && World.terrain[i] === T_ROCK) list.push([y + 1.3, () => drawCrystalTile(c, x, y, i)]);
  }
  for (const b of Game.buildings) {
    if (b.x + b.w < x0 - 2 || b.x > x1 + 2 || b.y > y1 + 2 || b.y + b.h < y0 - 2) continue;
    list.push([b.y + b.h - 0.05, () => drawBuilding(c, b, false)]);
  }
  for (const u of Game.units) {
    if (u.inside) continue;
    if (u.x < x0 - 1 || u.x > x1 + 1 || u.y < y0 - 1 || u.y > y1 + 2) continue;
    list.push([u.y + 0.2, () => drawUnit(c, u)]);
  }
  for (const a of Game.animals) {
    if (a.x < x0 - 1 || a.x > x1 + 1 || a.y < y0 - 1 || a.y > y1 + 2) continue;
    const load = a.kind === 'goose' ? (a.state === 'chase' ? 'attack' : a.swim ? 'swim' : null) : a.loot;
    list.push([a.y + 0.2, () => drawCreatureAt(c, a.kind, Math.round(a.x * TILE), Math.round(a.y * TILE + 4), a.face, a.moving, a.phase, load)]);
  }
  for (const b of Game.critters || []) list.push([b.y + 0.1, () => drawButterfly(c, b)]);
  weatherDrawList(list, c, x0, y0, x1, y1);
  festDrawList(list, c, x0, y0, x1, y1);
  faunaDrawList(list, c, x0, y0, x1, y1);
  fauna2DrawList(list, c, x0, y0, x1, y1);
  beastsDrawList(list, c, x0, y0, x1, y1);
  chestsDrawList(list, c, x0, y0, x1, y1);
  fairyDrawList(list, c, x0, y0, x1, y1);
  fairy2DrawList(list, c, x0, y0, x1, y1);
  drawSkeletons(list, c, x0, y0, x1, y1);
  golemDrawList(list, c, x0, y0, x1, y1);
  if (typeof tradeDrawList === 'function') tradeDrawList(list, c, x0, y0, x1, y1);
  for (const e of Game.ents || []) {
    if (e.x < x0 - 3 || e.x > x1 + 3 || e.y < y0 - 1 || e.y > y1 + 4) continue;
    list.push([(e.state === 'sleep' || e.k < 0.3) ? Math.floor(e.y) + 0.95 : e.y + 0.05, () => drawEnt(c, e)]);   // спящее — поверх своего ствола, под кронами впереди; гном рядом на той же линии — перед деревом
  }
  for (const p of Game.piles.values()) {
    list.push([p.y + 0.5, () => drawPile(c, p)]);
  }
  list.sort((a, b) => a[0] - b[0]);
  for (const [, fn] of list) fn();

  drawGamesAir(c);
  drawOwls(c);
  drawBats(c);
  drawGhosts(c);
  drawFloaters(c);
  drawClouds(c);
  drawDusk(c);
  drawNight(c, x0, y0, x1, y1);
  drawNightFx(c);
  drawFireflies(c);
  drawWeather(c);
  drawStatusIcons(c, x0, y0, x1, y1);
  drawLogMark(c);
  drawTutMarks(c);
  drawOverlay(c);
}

// Радиусы большого костра: кольца с подписями (выбран костёр, ставится новый или ?rings=1)
const BONFIRE_RINGS = [
  [BONFIRE_NOSPAWN, 'rgba(150,110,220,', 'нечисть не рождается'],
  [BONFIRE_SAFE, 'rgba(255,170,60,', 'свет и защита'],
  [BONFIRE_HERO, 'rgba(110,210,120,', 'возрождение и сбор'],
];
R.showRings = typeof location !== 'undefined' && /[?&]rings=1/.test(location.search);
function drawBonfireRings(c, cx, cy) {
  c.save();
  c.font = '10px sans-serif'; c.textAlign = 'center';
  for (const [r, col, label] of BONFIRE_RINGS) {
    const px = r * TILE;
    c.fillStyle = col + '0.07)'; c.strokeStyle = col + '0.75)'; c.lineWidth = 1.5;
    c.setLineDash([6, 5]); c.lineDashOffset = -Game.time * 8;
    c.beginPath(); c.arc(cx, cy, px, 0, 7); c.fill(); c.stroke();
    c.setLineDash([]);
    const t = label + ' · ' + r;
    const w = c.measureText(t).width + 8;
    c.fillStyle = 'rgba(20,16,10,0.7)'; c.fillRect(cx - w / 2, cy - px - 7, w, 14);
    c.fillStyle = col + '1)'; c.fillText(t, cx, cy - px + 4);
  }
  c.restore();
}

function drawOverlay(c) {
  const sel = Game.selected;
  const ant = (x, y, w, h, col) => {
    const off = Math.floor(Game.time * 10) % 6;
    c.fillStyle = col;
    for (let k = -off; k < w; k += 6) { c.fillRect(x + Math.max(0, k), y, Math.min(3, w - k), 1); c.fillRect(x + Math.max(0, k), y + h - 1, Math.min(3, w - k), 1); }
    for (let k = -off; k < h; k += 6) { c.fillRect(x, y + Math.max(0, k), 1, Math.min(3, h - k)); c.fillRect(x + w - 1, y + Math.max(0, k), 1, Math.min(3, h - k)); }
  };
  if (sel && !sel.removed) {
    if (sel.isRoad) ant(sel.x * TILE + 2, sel.y * TILE + 2, TILE - 4, TILE - 4, '#f6d458');
    else ant(sel.x * TILE, sel.y * TILE, sel.w * TILE, sel.h * TILE, '#f6d458');
  }
  if (sel && !sel.removed && sel.type === 'bonfire') drawBonfireRings(c, (sel.x + sel.w / 2) * TILE, (sel.y + sel.h / 2) * TILE);
  else if (R.showRings) for (const b of Game.buildings) if (b.type === 'bonfire' && b.state === 'done') drawBonfireRings(c, (b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE);
  const tool = Game.tool, h = R.hover;
  if (!tool && h && inb(h[0], h[1])) {
    const id = World.bmap[idx(h[0], h[1])];
    const hb = id && Game.buildings.find(b => b.id === id);
    if (hb && hb !== sel) ant(hb.x * TILE, hb.y * TILE, hb.w * TILE, hb.h * TILE, 'rgba(255,255,255,0.6)');
  }
  if (!tool || !h) return;
  if (tool.kind === 'build') {
    const d = bDims(tool.type, tool.rot || 0);
    const bx = h[0] - Math.floor(d.w / 2), by = h[1] - d.h + 1;
    const err = checkPlacement(tool.type, bx, by, d.rot);
    if (tool.type === 'bonfire') drawBonfireRings(c, (bx + d.w / 2) * TILE, (by + d.h / 2) * TILE);
    c.fillStyle = err ? 'rgba(220,40,30,0.35)' : 'rgba(60,220,80,0.3)';
    c.fillRect(bx * TILE, by * TILE, d.w * TILE, d.h * TILE);
    c.globalAlpha = 0.7;
    drawBuilding(c, { type: tool.type, rot: d.rot, x: bx, y: by, w: d.w, h: d.h, doorX: bx + d.dx, doorY: by + d.dy, state: 'done', anim: 0, id: 0, stock: emptyGoods(), pigs: [] }, true);
    c.globalAlpha = 1;
    ant((bx + d.dx) * TILE + 2, (by + d.dy) * TILE + 2, TILE - 4, TILE - 4, err ? '#ff5040' : '#60ff80');
  } else if (tool.kind === 'road') {
    const cells = R.roadDrag || [h];
    const single = cells.length === 1;
    for (const [x, y] of cells) {
      const px = x * TILE, py = y * TILE;
      const exists = inb(x, y) && (World.road[idx(x, y)] || Game.roadSites.has(idx(x, y)));
      const ok = canPlaceRoad(x, y);
      if (exists && single) {
        // клик уберёт дорогу: красная клетка с крестом, как у полей
        c.fillStyle = 'rgba(224,64,48,0.4)'; c.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        c.strokeStyle = '#e04030'; c.lineWidth = 1.2; c.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
        c.fillStyle = '#e04030';
        for (let k = 0; k < 14; k++) { c.fillRect(px + 9 + k, py + 9 + k, 2, 2); c.fillRect(px + 22 - k, py + 9 + k, 2, 2); }
      } else if (exists) {
        c.fillStyle = 'rgba(200,190,170,0.22)'; c.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);     // уже дорога — просто проходим
      } else if (ok) {
        c.fillStyle = 'rgba(214,200,170,0.4)'; c.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        c.strokeStyle = '#e0d2a8'; c.lineWidth = 1.2; c.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
        if (single) {   // значок: три булыжника
          for (const [dx, dy, r] of [[11, 18, 4.4], [20, 17, 4], [16, 11, 4.2]]) {
            ellipse(c, px + dx + 0.6, py + dy + 0.8, r, r * 0.7, '#2e2822');
            ellipse(c, px + dx, py + dy, r, r * 0.7, '#8e867a');
            ellipse(c, px + dx - r * 0.3, py + dy - r * 0.25, r * 0.5, r * 0.3, '#cfc8b8');
          }
        }
      } else {
        c.fillStyle = 'rgba(224,64,48,0.3)'; c.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        c.strokeStyle = '#e04030'; c.lineWidth = 1.2; c.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
      }
    }
  } else if (tool.kind === 'field') {
    const o = World.obj[idx(h[0], h[1])], has = o && o.t === 'field';
    const ok = has || isFreeGrass(h[0], h[1]);
    const fc = FIELD_COL[tool.crop === 'hops' ? 'hops' : 'wheat'];
    c.fillStyle = has ? 'rgba(224,64,48,0.4)' : ok ? fc[1] : 'rgba(224,64,48,0.3)';
    c.fillRect(h[0] * TILE + 2, h[1] * TILE + 2, TILE - 4, TILE - 4);
    c.strokeStyle = has ? '#e04030' : ok ? fc[0] : '#e04030'; c.lineWidth = 1.2;
    c.strokeRect(h[0] * TILE + 2.5, h[1] * TILE + 2.5, TILE - 5, TILE - 5);
    if (has) { c.fillStyle = '#e04030'; for (let k = 0; k < 14; k++) { c.fillRect(h[0] * TILE + 9 + k, h[1] * TILE + 9 + k, 2, 2); c.fillRect(h[0] * TILE + 22 - k, h[1] * TILE + 9 + k, 2, 2); } }
    else if (ok) { c.globalAlpha = 0.9; cropGlyph(c, tool.crop, h[0] * TILE + 16, h[1] * TILE + 17, 1.1); c.globalAlpha = 1; }
  } else if (tool.kind === 'erase') {
    c.fillStyle = '#e04030';
    for (let k = 0; k < 18; k++) {
      c.fillRect(h[0] * TILE + 7 + k, h[1] * TILE + 7 + k, 2, 2);
      c.fillRect(h[0] * TILE + 24 - k, h[1] * TILE + 7 + k, 2, 2);
    }
  }
}

// ---------- Миникарта ----------

const MINI = { canvas: null, ctx: null, base: null };

function initMinimap(canvas) {
  MINI.canvas = canvas;
  MINI.ctx = canvas.getContext('2d');
  MINI.base = mkCanvas(MAP_W * 3, MAP_H * 3);
}

function updateMinimapBase() {
  const c = MINI.base.getContext('2d');
  c.drawImage(TERR.mini, 0, 0);
  for (let i = 0; i < N_TILES; i++) {
    const x = (i % MAP_W) * 3, y = ((i / MAP_W) | 0) * 3, o = World.obj[i];
    if (World.road[i]) { c.fillStyle = '#cc9a64'; c.fillRect(x, y, 3, 3); }
    if (World.crystal[i]) { c.fillStyle = '#9c7ae6'; c.fillRect(x + 1, y + 1, 2, 2); }
    if (o) {
      if (o.t === 'tree') { c.fillStyle = o.g >= 1 ? '#1c2818' : '#3a5a2a'; c.fillRect(x, y, 3, 3); }
      else if (o.t === 'stone') { c.fillStyle = '#cec6ba'; c.fillRect(x + 1, y + 1, 2, 2); }
      else if (o.t === 'field') { c.fillStyle = '#c89226'; c.fillRect(x, y, 3, 3); }
    }
  }
  for (const b of Game.buildings) {
    c.fillStyle = '#160e0a'; c.fillRect(b.x * 3 - 1, b.y * 3 - 1, b.w * 3 + 2, b.h * 3 + 2);
    c.fillStyle = b.state === 'done' ? '#e07a50' : '#cc9a64';
    c.fillRect(b.x * 3, b.y * 3, b.w * 3, b.h * 3);
  }
}

function drawMinimap() {
  const c = MINI.ctx, cv = MINI.canvas;
  c.imageSmoothingEnabled = false;
  c.drawImage(MINI.base, 0, 0, cv.width, cv.height);
  const sx = cv.width / (MAP_W * TILE), sy = cv.height / (MAP_H * TILE);
  const s = camScale();
  c.strokeStyle = '#f6f2ea'; c.lineWidth = 2;
  drawMinimapUnits();
  c.strokeRect(R.cam.x * sx, R.cam.y * sy, R.canvas.clientWidth / s * sx, R.canvas.clientHeight / s * sy);
}

// Персонажи на миникарте: свои гномы — зелёные, звери — серые, нечисть — красная
function drawMinimapUnits() {
  const c = MINI.ctx, cv = MINI.canvas;
  const kx = cv.width / MAP_W, ky = cv.height / MAP_H, fac = cv.width / Math.max(60, cv.clientWidth);   // точки не мельче 3 пикселей на экране
  const dot = (x, y, col, s = 2.4) => {
    s = Math.max(s, 3 * fac); const px = x * kx - s / 2, py = y * ky - s / 2;
    c.fillStyle = 'rgba(8,6,4,0.85)'; c.fillRect(px - 0.8, py - 0.8, s + 1.6, s + 1.6);
    c.fillStyle = col; c.fillRect(px, py, s, s);
  };
  for (const a of Game.animals || []) if (!a.dead) dot(a.x, a.y, '#b4b4b4', 2);
  for (const u of Game.units) {
    if (u.inside || u.dead) continue;
    if (UNIT_TYPES[u.type].animal) dot(u.x, u.y, '#b4b4b4', 2);          // вьючные козы
    else dot(u.x, u.y, '#5ee05e', u.hero ? 3.6 : 2.4);
  }
  for (const e of Game.ents || []) if (e.k > 0.3 && e.state !== 'sleep' && e.state !== 'done' && e.state !== 'gone' && e.state !== 'root') dot(e.x, e.y, '#ff3a30', 3);
  for (const s of Game.skels || []) if (s.k > 0.3 && s.state !== 'dead') dot(s.x, s.y, '#ff3a30', 2.6);
  for (const g of Game.ghosts || []) if (g.alpha > 0.3) dot(g.x, g.y, '#ff3a30', 2.6);
}
