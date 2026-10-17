'use strict';
// Призраки: с вечера бродят над деревней 1–3 прозрачных гнома-тени. Пугают всех, кого видят —
// и гномов, и нечисть, — но сами безобидны. Призрака можно задобрить хлебом: гном с хлебом в руках
// отдаёт его, призрак успокаивается, благодарит и (иногда) оставляет золотую монету.

const GHOST_SEE = 4.5, GHOST_SEE_ENT = 5.5;

function ghostsSpawn(n) {
  const gs = Game.ghosts || (Game.ghosts = []);
  const live = Game.units.filter(u => !u.dead);
  const gy = graveyardOf(), cap = Math.min(12, 4 + Math.floor((Game.lostGnomes || 0) / 3));
  for (let i = 0; i < n && gs.length < cap; i++) {
    const u = live.length ? live[(Math.random() * live.length) | 0] : null;
    const x = (u ? u.x : MAP_W / 2) + (Math.random() - 0.5) * 16, y = (u ? u.y : MAP_H / 2) + (Math.random() - 0.5) * 12;
    let gx = Math.max(2, Math.min(MAP_W - 2, x)), gy0 = Math.max(2, Math.min(MAP_H - 2, y));
    if (gy) { gx = gy.x + 1 + Math.random() * (gy.w - 2); gy0 = gy.y + 0.5 + Math.random() * (gy.h - 1); }   // выходят из кладбища
    gs.push({ x: gx, y: gy0, hx: gx, hy: gy0, alpha: 0, ph: Math.random() * 9, face: 1,
      mode: 'drift', modeT: 0, tx: gx, ty: gy0, retarget: 0, scan: Math.random() });
  }
  if (n > 0) logEvent('night', 'Над деревней поплыли призраки');
}

function ghostSay(g, text) { floater(g.x, g.y - 1.6, text, '#cfe6ff'); }

function ghostsTick(dt) {
  const gs = Game.ghosts;
  if (!gs || !gs.length) return;
  const dark = nightAmt();
  for (let i = gs.length - 1; i >= 0; i--) {
    const g = gs[i];
    g.ph += dt * 2.2; g.modeT -= dt; g.retarget -= dt;
    const leaving = g.mode === 'leave' || dark < 0.12;
    g.alpha = Math.max(0, Math.min(1, g.alpha + (leaving ? -dt * 0.5 : dt * 0.35)));
    if (leaving && g.alpha <= 0) { gs.splice(i, 1); continue; }
    if (g.mode !== 'drift' && g.modeT <= 0) {
      if (g.mode === 'calm') {
        // наелся: благодарит, иногда оставляет монету, растворяется
        ghostSay(g, ['Спасибо…', 'Вкусно… я помню вкус…', 'Теперь можно и на покой'][Math.floor(Math.random() * 3)]);
        if (Math.random() < 0.38) { dropPile(Math.floor(g.x), Math.floor(g.y), 'gold', 1); logEvent('night', 'Призрак отблагодарил золотой монеткой', g.x, g.y); }
        g.mode = 'leave'; g.modeT = 99;
      } else g.mode = 'drift';
    }
    if (g.mode === 'drift' || g.mode === 'boo') {
      if (g.retarget <= 0 || Math.hypot(g.tx - g.x, g.ty - g.y) < 0.6) {
        g.tx = g.hx + (Math.random() - 0.5) * 18; g.ty = g.hy + (Math.random() - 0.5) * 14; g.retarget = 3 + Math.random() * 5;
        // иногда тянется к ближайшему гному
        if (Math.random() < 0.5) { const u = Game.units[(Math.random() * Game.units.length) | 0]; if (u && !u.inside) { g.tx = u.x; g.ty = u.y; } }
      }
      const dx = g.tx - g.x, dy = g.ty - g.y, d = Math.hypot(dx, dy) || 1, sp = g.mode === 'boo' ? 0.2 : 0.9;
      g.x += dx / d * sp * dt; g.y += dy / d * sp * dt; g.face = dx >= 0 ? 1 : -1;
    }
    if (leaving) continue;
    g.scan -= dt;
    if (g.scan > 0) continue;
    g.scan = 0.7;
    // гномы: либо угощение, либо испуг
    for (const u of Game.units) {
      if (u.inside || u.dead || !isPerson(u) || u.type === 'carter' || (u.ghostCD || 0) > Game.time) continue;
      if (Math.hypot(u.x - g.x, u.y - g.y) > GHOST_SEE) continue;
      if (g.mode === 'drift' && u.carry === 'bread' && Math.random() < 0.6) {
        u.ghostCD = Game.time + 40;
        u.carryN = (u.carryN || 1) - 1; if (u.carryN <= 0) u.carry = null;
        g.mode = 'calm'; g.modeT = 7; g.tx = g.x; g.ty = g.y;
        floater(u.x, u.y - 1.2, 'Хлебушек… держи', '#ffe9b0');
        logEvent('night', `${UNIT_TYPES[u.type].name} угостил призрака хлебом`, u.x, u.y);
        break;
      }
      if (!interruptible(u)) continue;
      u.ghostCD = Game.time + 40;
      floater(u.x, u.y - 1.2, 'Призрак!', '#dcecff');
      if (Math.random() < 0.5) { startBreak(u, 'freeze', null); u.proc = freezeGen(u); }
      else { startBreak(u, 'flee', null); u.proc = fleeGen(u); }
      if (g.mode === 'drift') { g.mode = 'boo'; g.modeT = 1.6; sfxAt('wail', g.x * TILE, g.y * TILE, 1); }
    }
    // нечисть тоже боится: пятится и бросает свои дела
    for (const e of Game.ents || []) {
      if ((e.state !== 'walk' && e.state !== 'smash') || (e.ghostCD || 0) > Game.time) continue;
      if (Math.hypot(e.x - g.x, e.y - g.y) > GHOST_SEE_ENT) continue;
      e.ghostCD = Game.time + 30;
      e.target = null; e.goal = null; e.state = 'ghosted'; e.t = 0; e.gFrom = [g.x, g.y];
      floater(e.x, e.y - (e.rock ? 1.2 : 2.6), 'У-у-у!..', '#dcecff');
      if (g.mode === 'drift') { g.mode = 'boo'; g.modeT = 1.6; sfxAt('wail', g.x * TILE, g.y * TILE, 1); }
    }
  }
}

function ghostLights(L, x0, y0, x1, y1) {
  for (const g of Game.ghosts || []) if (g.x > x0 - 4 && g.x < x1 + 4 && g.y > y0 - 4 && g.y < y1 + 4)
    L.push([g.x * TILE, g.y * TILE - 12, 46, 0.5 * g.alpha, 'ent']);
}

function drawGhosts(c) {
  const t = Game.time;
  for (const g of Game.ghosts || []) {
    if (g.alpha <= 0.01) continue;
    const bob = Math.sin(g.ph) * 2.2, px = Math.round(g.x * TILE), py = Math.round(g.y * TILE - 15 - bob);
    const boo = g.mode === 'boo', calm = g.mode === 'calm';
    const flick = 0.78 + Math.sin(t * 13 + g.ph * 3) * 0.1 + (Math.sin(t * 31 + g.ph) > 0.93 ? -0.3 : 0);     // мерцает, как гаснущая свеча
    const A = g.alpha * flick;
    c.save();
    // холодное зеленоватое свечение вокруг
    c.globalAlpha = A * 0.45; c.globalCompositeOperation = 'lighter';
    const gl = c.createRadialGradient(px, py, 2, px, py, 26); gl.addColorStop(0, 'rgba(120,255,190,0.5)'); gl.addColorStop(1, 'rgba(120,255,190,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(px, py, 26, 0, 7); c.fill();
    c.globalCompositeOperation = 'source-over';
    // тень на земле: чёрная, дрожащая
    c.globalAlpha = g.alpha * 0.4; c.fillStyle = 'rgba(0,10,10,0.7)'; c.beginPath(); c.ellipse(px, g.y * TILE + 2, 8 + Math.sin(g.ph * 2) * 1.2, 2.2, 0, 0, 7); c.fill();
    c.translate(px, py); c.scale(g.face, 1);
    c.globalAlpha = A * 0.8;
    c.lineJoin = 'round'; c.lineCap = 'round';
    const sway = Math.sin(g.ph * 1.3) * 1.6;
    // рваный саван: лохмотья-полосы тянутся вниз и в стороны
    const sg = c.createLinearGradient(0, -10, 0, 22); sg.addColorStop(0, '#cfe6dc'); sg.addColorStop(0.5, '#7fa89a'); sg.addColorStop(1, 'rgba(60,100,96,0)');
    c.fillStyle = sg; c.beginPath(); c.moveTo(-8, -6);
    c.quadraticCurveTo(-11, 6, -9 + sway, 14);
    for (let i = 0; i < 6; i++) { const x = -9 + sway + i * 3.5, len = 20 + (i * 7 % 5) * 2 + Math.sin(g.ph * 2.2 + i * 1.7) * 2.5; c.lineTo(x + 1.2, len - 3); c.lineTo(x + 2.4, 12 + (i % 2) * 2); }
    c.quadraticCurveTo(11, 6, 8, -6); c.quadraticCurveTo(0, -11, -8, -6); c.fill();
    // тёмные складки на саване
    c.strokeStyle = 'rgba(10,30,30,0.5)'; c.lineWidth = 1.1;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 3.5, -2); c.quadraticCurveTo(i * 5 + sway * 0.5, 8, i * 4 + sway, 16); c.stroke(); }
    // длинные костлявые руки с когтями: тянутся вперёд, при «бу» воздеты
    const rz = boo ? 1 : calm ? -0.3 : 0.2;
    c.strokeStyle = '#d8f0e6'; c.lineWidth = 2;
    for (const s of [-1, 1]) {
      const up = boo ? -17 : calm ? 7 : -3 + Math.sin(g.ph * 2 + s) * 2.4;
      const hx = s * (boo ? 12 : 13), hy = up + 2;
      c.beginPath(); c.moveTo(s * 6, -4); c.quadraticCurveTo(s * 11, up * 0.4 + 4, hx, hy); c.stroke();
      c.lineWidth = 0.9;
      for (let j = -1; j <= 1; j++) { c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + s * 3.6 + j * 0.8, hy + j * 2.6 + (boo ? -3 : 1.5)); c.stroke(); }   // когти
      c.lineWidth = 2;
    }
    // борода — клочьями, как мокрые водоросли
    c.strokeStyle = '#e6f5ee'; c.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 1.2, -4); c.quadraticCurveTo(i * 1.6 + Math.sin(g.ph * 2 + i) * 1.4, 4, i * 1.1 + Math.sin(g.ph * 2.6 + i * 1.3) * 2, 11 + Math.abs(i)); c.stroke(); }
    // голова: череп с впалыми щеками
    c.fillStyle = '#e2f2ea'; c.beginPath(); c.ellipse(0, -9, 6, 7.2, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(30,60,58,0.45)'; c.beginPath(); c.ellipse(-4.4, -6, 1.6, 3, 0.3, 0, 7); c.ellipse(4.4, -6, 1.6, 3, -0.3, 0, 7); c.fill();   // запавшие щёки
    // рваный колпак с дырой и сломанным кончиком
    c.fillStyle = '#7c9a92'; c.beginPath(); c.moveTo(-7, -12); c.quadraticCurveTo(-4, -21, 2 + sway * 0.4, -27); c.lineTo(5 + sway * 0.4, -23); c.lineTo(3.5 + sway, -20); c.quadraticCurveTo(5, -16, 7.5, -12); c.lineTo(5, -13.4); c.lineTo(3, -12); c.lineTo(0.5, -13.6); c.lineTo(-2, -12); c.lineTo(-4.6, -13.2); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.85)'; c.beginPath(); c.ellipse(-1.5, -17, 1.3, 1.9, 0.5, 0, 7); c.fill();
    // впалые чёрные глазницы под сердитым наклоном, внутри — крошечные тлеющие точки
    c.globalAlpha = g.alpha * 0.98; c.fillStyle = '#010a09';
    const eh = boo ? 4.4 : 3.6;
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(s * 1.0, -11.4 + s * 0.0); c.lineTo(s * 5.4, -12.6); c.lineTo(s * 4.6, -9.2 + eh * 0.2); c.quadraticCurveTo(s * 3.2, -9.4 + eh, s * 1.8, -8.6 + eh * 0.5); c.closePath(); c.fill();
    }
    const gz = Math.sin(t * 1.7 + g.ph) * 0.6;
    c.globalAlpha = g.alpha; c.fillStyle = boo ? '#ff4a2a' : calm ? '#9ad8ff' : '#c8ffd8';
    c.beginPath(); c.arc(-3 + gz, -9.6, boo ? 1.1 : 0.65, 0, 7); c.arc(3 + gz, -9.6, boo ? 1.1 : 0.65, 0, 7); c.fill();
    // рот: чёрная рваная пасть-провал, острые клыки сверху
    c.globalAlpha = g.alpha * 0.98; c.fillStyle = '#010a09';
    const mh = boo ? 8.5 + Math.sin(t * 22) * 0.9 : calm ? 1.2 : 4.4 + Math.sin(g.ph * 3) * 0.8;
    c.beginPath(); c.moveTo(-3, -4.4);
    for (let i = 0; i <= 6; i++) c.lineTo(-3 + i, -4.4 + (i % 2 ? 0.8 : -0.4));
    c.lineTo(3.2, -4.4 + mh * 0.5); c.lineTo(1.6, -4 + mh); c.lineTo(0, -4 + mh * 0.8); c.lineTo(-1.6, -4 + mh); c.lineTo(-3.2, -4.4 + mh * 0.5); c.closePath(); c.fill();
    c.fillStyle = '#dcefe6'; for (const x of [-2.2, -0.8, 0.8, 2.2]) { c.beginPath(); c.moveTo(x - 0.6, -4.3); c.lineTo(x, -4.3 + (boo ? 3.2 : 1.8)); c.lineTo(x + 0.6, -4.3); c.fill(); }
    c.restore();
    // клочья тумана, уходящие вверх от призрака
    c.save(); c.globalAlpha = 1;
    for (let j = 0; j < 4; j++) { const q = (t * 0.5 + j * 0.25 + g.ph) % 1; c.fillStyle = `rgba(190,255,225,${0.28 * (1 - q) * g.alpha})`; c.beginPath(); c.arc(px + Math.sin(q * 6 + j * 2) * 8, py + 10 - q * 30, 2 + q * 3, 0, 7); c.fill(); }
    c.restore();
  }
}
