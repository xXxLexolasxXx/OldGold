'use strict';
// Призраки: с вечера бродят над деревней 1–3 прозрачных гнома-тени. Пугают всех, кого видят —
// и гномов, и нечисть, — но сами безобидны. Призрака можно задобрить хлебом: гном с хлебом в руках
// отдаёт его, призрак успокаивается, благодарит и (иногда) оставляет золотую монету.

const GHOST_SEE = 4.5, GHOST_SEE_ENT = 5.5;

function ghostsSpawn(n) {
  const gs = Game.ghosts || (Game.ghosts = []);
  const live = Game.units.filter(u => !u.dead);
  for (let i = 0; i < n && gs.length < 4; i++) {
    const u = live.length ? live[(Math.random() * live.length) | 0] : null;
    const x = (u ? u.x : MAP_W / 2) + (Math.random() - 0.5) * 16, y = (u ? u.y : MAP_H / 2) + (Math.random() - 0.5) * 12;
    const gx = Math.max(2, Math.min(MAP_W - 2, x)), gy = Math.max(2, Math.min(MAP_H - 2, y));
    gs.push({ x: gx, y: gy, hx: gx, hy: gy, alpha: 0, ph: Math.random() * 9, face: 1,
      mode: 'drift', modeT: 0, tx: gx, ty: gy, retarget: 0, scan: Math.random() });
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
  for (const g of Game.ghosts || []) {
    if (g.alpha <= 0.01) continue;
    const bob = Math.sin(g.ph) * 2, px = Math.round(g.x * TILE), py = Math.round(g.y * TILE - 12 - bob);
    const boo = g.mode === 'boo', calm = g.mode === 'calm';
    c.save();
    c.globalAlpha = g.alpha * 0.5;
    c.fillStyle = 'rgba(160,200,255,0.5)'; c.beginPath(); c.ellipse(px, g.y * TILE + 2, 6, 1.6, 0, 0, 7); c.fill();   // дрожащая тень на траве
    c.globalAlpha = g.alpha * 0.62;
    c.translate(px, py); c.scale(g.face, 1);
    const sway = Math.sin(g.ph * 1.3) * 1.2;
    // подол «рубахи» волнами вместо ног
    c.fillStyle = '#dbe8ff';
    c.beginPath(); c.moveTo(-6, -2); c.quadraticCurveTo(-7, 6, -5 + sway, 11);
    for (let i = 0; i <= 5; i++) c.lineTo(-5 + sway + i * 2, 11 + (i % 2 ? 2.5 : 0) + Math.sin(g.ph * 2 + i));
    c.quadraticCurveTo(7, 6, 6, -2); c.quadraticCurveTo(0, -5, -6, -2); c.fill();
    // руки: поднятые при «бу», опущенные в спокойствии
    c.strokeStyle = '#cfe0ff'; c.lineWidth = 2.2; c.lineCap = 'round';
    const up = boo ? -9 : calm ? 3 : -2;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 5, 1); c.quadraticCurveTo(s * 9, up + 3, s * 8, up + Math.sin(g.ph * 3 + s) * 1.5); c.stroke(); }
    // борода
    c.fillStyle = '#f1f6ff'; c.beginPath(); c.moveTo(-4, -1); c.quadraticCurveTo(0, 12, 4, -1); c.quadraticCurveTo(0, 1, -4, -1); c.fill();
    // голова и колпак
    c.fillStyle = '#e8f0ff'; c.beginPath(); c.arc(0, -7, 5, 0, 7); c.fill();
    c.fillStyle = '#c3d4f5'; c.beginPath(); c.moveTo(-6, -8); c.quadraticCurveTo(-2, -13, 3 + sway, -19); c.quadraticCurveTo(4, -13, 6, -8); c.closePath(); c.fill();
    c.fillRect(-6.2, -9, 12.4, 1.8);
    // пустые глазницы
    c.globalAlpha = g.alpha * 0.9; c.fillStyle = '#12202e';
    c.beginPath(); c.ellipse(-2, -7, 1.2, boo ? 2.4 : 1.6, 0, 0, 7); c.ellipse(2, -7, 1.2, boo ? 2.4 : 1.6, 0, 0, 7); c.fill();
    if (boo) { c.beginPath(); c.ellipse(0, -3.4, 1.3, 2, 0, 0, 7); c.fill(); }
    else if (calm) c.fillRect(-1.4, -3.6, 2.8, 0.7);
    c.restore();
  }
}
