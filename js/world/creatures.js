'use strict';
// Звери и упряжки: олень, кролик, коза (дикая и вьючная), волк, телега извозчика.
// Рисуются боком, мордой вправо (влево — отражением). Кэшируются по кадрам.

const CR_CACHE = afLru(16e6);   // кадры с грузом и телеги множатся — давние вытесняются (animalart.js)
const CR_SIZE = { henbuff: [22, 30, 11, 28], deer: [34, 37, 17, 34], rabbit: [18, 14, 9, 12], goat: [28, 26, 14, 23], packgoat: [28, 28, 14, 25], wolf: [32, 24, 16, 21], cart: [56, 38, 28, 33], chicken: [16, 15, 8, 13], goose: [26, 24, 12, 21], elk: [46, 46, 23, 42], fox: [28, 20, 14, 17], duck: [22, 20, 11, 17] };

// Курица: белая, красный гребешок, семенит; noLegs — тело без ног (для куриной мести на накачанных ногах)
function drawChicken(c, f, peck, noLegs) {
  const step = f === null ? 0 : Math.sin(f / CR_N * Math.PI * 2);
  if (!noLegs) { line(c, -1, 9, -1 + step * 1.2, 13, '#e0a030', 0.6); line(c, 1, 9, 1 - step * 1.2, 13, '#e0a030', 0.6); }
  c.fillStyle = '#f0ece0'; c.beginPath(); c.moveTo(-5.4, 4); c.lineTo(-3.6, 7); c.lineTo(-6, 7.4); c.closePath(); c.fill();   // хвост
  ellipse(c, -0.4, 7, 4.2, 3, '#f4f0e6'); ellipse(c, -0.8, 7.6, 2.6, 1.6, '#d8d0c0');
  c.save(); if (peck) c.translate(1.8, 3.4);   // клюёт: голова вниз и вперёд
  ellipse(c, 2.8, 3.4, 1.8, 1.8, '#f4f0e6');
  ellipse(c, 2.6, 1.4, 1.1, 0.7, '#d83a24'); ellipse(c, 3.6, 4.8, 0.5, 0.7, '#d83a24');   // гребешок, бородка
  poly(c, [[4.4, 3.2], [5.8, 3.6], [4.4, 4.2]], '#e8a028');
  c.fillStyle = '#1a1210'; c.fillRect(3.1, 2.8, 0.5, 0.5);
  c.restore();
}

// Месть кур: у курицы вырастают комично накачанные человеческие ноги, и она пинает гнома.
// load: 'g0..g3' — ноги растут, 'k0..k5' — пинок (угол бедра a и сгиб колена b), 's' — стоит. Длина ног L игровых px
const HEN_KICK = [[-0.5, 0.9], [0.4, 1.0], [1.2, 0.4], [1.55, 0], [0.8, 0.8], [0.1, 0.3]];
function henBuffPose(load) {
  const t = load || 's', L = t[0] === 'g' ? [0.3, 0.55, 0.8, 1][+t[1] || 0] * 9 : 9, k = t[0] === 'k' ? HEN_KICK[+t[1] || 0] : [0.06, 0.16];
  return { L, a: k[0], b: k[1], ka2: t[0] === 'k' ? -0.12 : -0.06, kb2: 0.12, kick: t[0] === 'k' };
}
function drawHenBuff(c, load) {
  const P = henBuffPose(load), L = P.L, hipY = 28 - 3.4 - L, th = L * 0.5, sk = '#e8b088', skd = '#c88c68', w = Math.max(1.2, L / 9 * 3.2);
  const leg = (hx, a, b, col) => {
    const kx = hx + Math.sin(a) * th, ky = hipY + Math.cos(a) * th, ax = kx + Math.sin(a - b) * th, ay = ky + Math.cos(a - b) * th;
    line(c, hx, hipY, kx, ky, col, w); ellipse(c, hx + (kx - hx) * 0.45, hipY + (ky - hipY) * 0.45, w * 0.75, w * 0.95, col);
    line(c, kx, ky, ax, ay, col, w * 0.65); ellipse(c, kx + (ax - kx) * 0.32, ky + (ay - ky) * 0.32, w * 0.6, w * 0.75, col);
    ellipse(c, ax + Math.cos(a - b) * 0.9, ay, w * 0.75, w * 0.32, col);
  };
  leg(-1.3, P.ka2, P.kb2, skd);
  ellipse(c, 0, hipY - 0.3, 2.4, 1.4, '#e4ddd0');
  c.save(); c.translate(0, hipY - 9.4 - Math.sin(Math.max(0, P.a)) * 0.6); drawChicken(c, null, false, true); c.restore();
  leg(1.3, P.a, P.b, sk);
}

// Ручной питомец (кролик, утка): красный бантик на шее и посылка на спине.
// load — флаги через запятую: T (ручной), swim (плывёт), c:<товар> (несёт посылку)
function petFlags(load) {
  const fl = typeof load === 'string' ? load.split(',') : [];
  const cg = fl.find(x => x.startsWith('c:'));
  return { tame: fl.includes('T'), swim: fl.includes('swim'), cargo: cg ? cg.slice(2) : null };
}
function petGear(c, load, nx, ny, bx, by) {
  const fl = petFlags(load);
  if (fl.tame) {
    poly(c, [[nx, ny], [nx + 1.9, ny - 1.1], [nx + 1.9, ny + 1.3]], '#d83a3a');
    poly(c, [[nx, ny], [nx - 1.9, ny - 1.1], [nx - 1.9, ny + 1.3]], '#b02828');
    ellipse(c, nx, ny, 0.55, 0.55, '#f0d060');
  }
  if (fl.cargo && GOODS[fl.cargo]) {
    // холщовый узелок с товаром на спине
    ellipse(c, bx, by - 0.2, 2.5, 1.7, '#cdbb92');
    c.strokeStyle = 'rgba(60,40,20,0.7)'; c.lineWidth = 0.35; c.beginPath(); c.ellipse(bx, by - 0.2, 2.5, 1.7, 0, 0, 7); c.stroke();
    c.save(); c.translate(bx, by - 2.6); c.scale(0.34, 0.34); drawLoad(c, fl.cargo); c.restore();
  }
}

// Утка: крякающая кряква. На суше семенит, на воде сидит в круге ряби
function drawDuck(c, f, load) {
  const fl = petFlags(load);
  const step = f === null ? 0 : Math.sin(f / CR_N * Math.PI * 2);
  const dy = fl.swim ? 2.4 : 0;
  if (fl.swim) {
    c.strokeStyle = 'rgba(235,245,255,0.55)'; c.lineWidth = 0.5;
    c.beginPath(); c.ellipse(0, 12.6, 8 + step * 0.6, 2.3, 0, 0, 7); c.stroke();
    c.beginPath(); c.ellipse(0, 12.6, 5.6, 1.5, 0, 0, 7); c.stroke();
  } else {
    line(c, -1, 10.4, -1.4 + step * 1.3, 13, '#e08a24', 0.7); line(c, 1.2, 10.4, 1.6 - step * 1.3, 13, '#e08a24', 0.7);
    line(c, -2.4 + step * 1.3, 13, -0.4 + step * 1.3, 13, '#e08a24', 0.6); line(c, 0.2 - step * 1.3, 13, 2.4 - step * 1.3, 13, '#e08a24', 0.6);
  }
  c.save(); c.translate(0, dy);
  poly(c, [[-4.4, 7.2], [-7.6, 4.6], [-6.4, 9]], '#5a4630');                                   // хвост
  ellipse(c, -0.6, 8, 5.4, 3.5, '#8a6a46');                                                      // тело
  ellipse(c, 0.4, 9.2, 4.2, 1.9, '#cdbb98');                                                     // светлое брюшко
  ellipse(c, -1.4, 7.6, 2.6, 1.5, '#6e5436'); poly(c, [[-2.8, 8.4], [0.2, 8.5], [-1, 9.1]], '#3a5aa0');   // крыло с «зеркальцем»
  ellipse(c, 3.2, 4.8, 1.9, 1.2, '#f2eee6');                                                     // белое кольцо на шее
  ellipse(c, 4.4, 2.6, 2.1, 1.9, '#2f7040');                                                     // зелёная голова
  poly(c, [[6.2, 2.4], [9, 3.3], [6.2, 4.2]], '#e8b830');                                        // клюв
  c.fillStyle = '#10100c'; c.fillRect(4.8, 1.7, 0.6, 0.6);
  petGear(c, load, 3.2, 5.4, -1, 5.2);
  c.restore();
}

// Гусь: длинная шея, оранжевый клюв; в атаке шея вытянута вперёд, крылья растопырены
function drawGoose(c, f, attack, swim) {
  const step = f === null ? 0 : Math.sin(f / CR_N * Math.PI * 2);
  if (swim) {
    // плывёт: лап не видно, тело сидит в воде, вокруг расходятся круги
    c.save(); c.translate(0, 5.5);
    c.fillStyle = '#ece8e0'; c.beginPath(); c.moveTo(-8.4, 9); c.lineTo(-5, 11.6); c.lineTo(-8, 12.4); c.closePath(); c.fill();
    ellipse(c, 0, 12, 7, 4.2, '#f2eee6'); ellipse(c, -1, 12, 5, 2, '#d6d0c4');
    c.strokeStyle = '#f2eee6'; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(5, 10); c.quadraticCurveTo(7.4, 6, 6.6, 2.6); c.stroke(); c.lineCap = 'butt';
    ellipse(c, 7, 2.2, 1.8, 1.5, '#f2eee6');
    poly(c, [[8.4, 1.8], [11, 2.6], [8.4, 3.2]], '#f08a20');
    c.fillStyle = '#1a1210'; c.fillRect(7.3, 1.6, 0.6, 0.6);
    // вода по «ватерлинии» и круги
    c.fillStyle = 'rgba(44,92,134,0.85)'; c.fillRect(-10, 13.4, 20, 4);
    c.strokeStyle = 'rgba(214,238,246,0.75)'; c.lineWidth = 0.6;
    c.beginPath(); c.ellipse(0, 13.6, 8.6 + step, 1.6, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(214,238,246,0.35)';
    c.beginPath(); c.ellipse(-2, 14, 11.5 + step * 1.4, 2.2, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
    return;
  }
  line(c, -1.4, 15, -1.4 + step * 1.6, 20.4, '#e08a20', 0.9); line(c, 1.4, 15, 1.4 - step * 1.6, 20.4, '#e08a20', 0.9);
  ellipse(c, -1.4 + step * 1.6, 20.6, 1.4, 0.5, '#e08a20'); ellipse(c, 1.4 - step * 1.6, 20.6, 1.4, 0.5, '#e08a20');
  c.fillStyle = '#ece8e0'; c.beginPath(); c.moveTo(-8.4, 9); c.lineTo(-5, 11.6); c.lineTo(-8, 12.4); c.closePath(); c.fill();
  ellipse(c, 0, 12, 7, 4.2, '#f2eee6');
  ellipse(c, -1, 13, 5, 2.4, '#d6d0c4');
  if (attack) {
    // крылья вверх, шея вперёд-вниз, клюв раскрыт
    poly(c, [[-3, 9], [-6, 2], [1, 8]], '#e2ddd2', '#b6ada0', 0.3);
    poly(c, [[0, 9], [2, 1.6], [4, 8.6]], '#ece8e0', '#b6ada0', 0.3);
    c.strokeStyle = '#f2eee6'; c.lineWidth = 2.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(5, 10); c.quadraticCurveTo(8.6, 8, 10.6, 9.6); c.stroke(); c.lineCap = 'butt';
    ellipse(c, 11, 9.4, 1.9, 1.6, '#f2eee6');
    poly(c, [[12.4, 8.6], [15, 8.4], [12.6, 9.4]], '#f08a20'); poly(c, [[12.4, 9.8], [14.6, 10.8], [12.4, 10.4]], '#d87010');
    c.fillStyle = '#1a1210'; c.fillRect(11.2, 8.6, 0.6, 0.6);
    line(c, 10.2, 8.2, 11.8, 8.4, '#3a2a20', 0.4);   // злая бровь
  } else {
    c.strokeStyle = '#f2eee6'; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(5, 10); c.quadraticCurveTo(7.4, 6, 6.6, 2.6); c.stroke(); c.lineCap = 'butt';
    ellipse(c, 7, 2.2, 1.8, 1.5, '#f2eee6');
    poly(c, [[8.4, 1.8], [11, 2.6], [8.4, 3.2]], '#f08a20');
    c.fillStyle = '#1a1210'; c.fillRect(7.3, 1.6, 0.6, 0.6);
  }
}

function crLegs(c, xs, top, len, f, col, w = 1.3) {
  xs.forEach((x, k) => {
    const sw = f === null ? 0 : Math.sin(f / CR_N * Math.PI * 2 + (k % 2 ? Math.PI : 0)) * 1.4;
    smoothLimb(c, [x, top], [x + sw * 0.4, top + len * 0.5], [x + sw, top + len], w, k < 2 ? shade(col, -0.3) : col);
  });
}

function drawGoatBody(c, f, col, pack, load) {
  const y0 = pack ? 2 : 0;
  crLegs(c, [-5, 4, -3.6, 5.4], 15 + y0, 7, f, shade(col, -0.1), 1.2);
  c.fillStyle = lingrad(c, 0, 9 + y0, 0, 17 + y0, [[0, shade(col, 0.15)], [1, shade(col, -0.25)]]);
  c.beginPath(); c.ellipse(0, 13 + y0, 8, 4.4, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(40,30,20,0.5)'; c.lineWidth = 0.3; c.stroke();
  // шея, голова, рога, бородка
  c.fillStyle = col; c.beginPath(); c.moveTo(5, 11 + y0); c.quadraticCurveTo(8, 6 + y0, 9.6, 6 + y0); c.lineTo(10.6, 9 + y0); c.quadraticCurveTo(8, 11 + y0, 7, 14 + y0); c.fill();
  c.beginPath(); c.ellipse(10.6, 6.6 + y0, 2.6, 1.8, 0.3, 0, Math.PI * 2); c.fill();
  ellipse(c, 12.6, 7.4 + y0, 1, 0.8, shade(col, -0.25));
  c.fillStyle = '#1a1210'; c.fillRect(10.4, 5.6 + y0, 0.6, 0.6);
  c.strokeStyle = '#8a7a60'; c.lineWidth = 0.9; c.lineCap = 'round';
  c.beginPath(); c.moveTo(9.6, 5 + y0); c.quadraticCurveTo(8, 1.4 + y0, 6.2, 2.6 + y0); c.stroke();
  c.lineCap = 'butt';
  ellipse(c, 8.6, 6.4 + y0, 1.4, 0.6, shade(col, -0.2));
  c.fillStyle = shade(col, -0.15); c.beginPath(); c.moveTo(11, 8 + y0); c.lineTo(10.6, 11 + y0); c.lineTo(12, 8.4 + y0); c.fill();
  c.fillStyle = shade(col, -0.1); c.beginPath(); c.moveTo(-7.6, 11 + y0); c.lineTo(-9.4, 9.6 + y0); c.lineTo(-8, 12.6 + y0); c.fill();
  if (pack) {
    // вьючные сумки
    c.fillStyle = lingrad(c, 0, 10, 0, 18, [[0, '#9a6a3a'], [1, '#5a3a1a']]);
    rrect(c, -4.6, 10 + y0, 8, 6.4, 1.6); c.fill();
    c.strokeStyle = '#3a2410'; c.lineWidth = 0.4; c.stroke();
    c.fillStyle = '#c89226'; c.fillRect(-1, 12 + y0, 1, 1);
    line(c, -4, 9 + y0, 3, 9 + y0, '#5a3a1e', 0.8);
    if (load) { c.save(); c.translate(-0.6, 6.4 + y0); c.scale(0.7, 0.7); drawLoad(c, load); c.restore(); }
  }
}

function drawCreature(c, kind, f, load) {
  if (kind === 'chicken') { drawChicken(c, f, load === 'peck'); return; }
  if (kind === 'henbuff') { drawHenBuff(c, load); return; }
  if (kind === 'goose') { drawGoose(c, f, load === 'attack', load === 'swim'); return; }
  if (kind === 'duck') { drawDuck(c, f, load); return; }
  if (kind === 'goat') { drawGoatBody(c, f, '#d8d0c0', false); return; }
  if (kind === 'packgoat') { drawGoatBody(c, f, '#e4ddd0', true, load); return; }
  if (kind === 'deer') {
    const col = '#9a6a3c';
    crLegs(c, [-6, 5, -4.4, 6.6], 17, 12, f, col, 1.3);
    c.fillStyle = lingrad(c, 0, 10, 0, 20, [[0, shade(col, 0.15)], [0.7, col], [1, '#e8dcc8']]);
    c.beginPath(); c.ellipse(0, 15, 9, 4.6, 0, 0, Math.PI * 2); c.fill();
    for (let k = 0; k < 5; k++) ellipse(c, -4 + k * 2.2, 13 - (k % 2), 0.5, 0.4, '#f0e6d0');
    c.fillStyle = col; c.beginPath(); c.moveTo(6, 13); c.quadraticCurveTo(9, 6, 10.6, 5); c.lineTo(12, 7); c.quadraticCurveTo(9.6, 10, 8.6, 15); c.fill();
    c.beginPath(); c.ellipse(12, 5.4, 2.8, 1.8, 0.4, 0, Math.PI * 2); c.fill();
    ellipse(c, 14.4, 6.4, 0.7, 0.6, '#1a1210');
    c.fillStyle = '#1a1210'; c.fillRect(11.8, 4.4, 0.6, 0.6);
    c.strokeStyle = '#d8c8a8'; c.lineWidth = 0.7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(11, 3.6); c.lineTo(9.6, -1); c.moveTo(10.2, 1); c.lineTo(8, 0); c.moveTo(9.8, -0.2); c.lineTo(11, -2.4);
    c.moveTo(12, 3.4); c.lineTo(13, -1); c.moveTo(12.6, 0.8); c.lineTo(14.6, 0); c.stroke();
    c.lineCap = 'butt';
    ellipse(c, -9, 13, 1.2, 1.6, '#f0e6d0');
    return;
  }
  if (kind === 'rabbit') {
    const hop = f === null ? 0 : Math.abs(Math.sin(f / CR_N * Math.PI * 2)) * 2.4;
    c.save(); c.translate(0, -hop);
    ellipse(c, 0, 8, 4.4, 3, '#9a8a74'); ellipse(c, 0.4, 9, 3, 1.8, '#c8bca8');
    ellipse(c, 3.8, 6, 2, 1.8, '#9a8a74');
    c.fillStyle = '#9a8a74'; c.beginPath(); c.ellipse(3, 2.4, 0.8, 2.6, -0.3, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(4.2, 2.6, 0.8, 2.6, 0.1, 0, Math.PI * 2); c.fill();
    ellipse(c, 3.1, 2.6, 0.35, 1.8, '#e0b0a8');
    c.fillStyle = '#1a1210'; c.fillRect(4.6, 5.4, 0.5, 0.5);
    ellipse(c, -4.2, 7.4, 1.2, 1.2, '#f4f0e8');
    petGear(c, load, 3.2, 4.8, 0, 5.2);
    c.restore();
    return;
  }
  if (kind === 'elk') {
    // лось: тёмно-бурый, горбатый, на длинных светлых ногах, огромные плоские рога
    const col = '#5a3a22', sock = '#b0a088';
    crLegs(c, [-7, 6.4, -5, 8], 15, 14, f, sock, 1.5);
    c.fillStyle = lingrad(c, 0, 6, 0, 20, [[0, shade(col, 0.12)], [0.7, col], [1, '#3a2616']]);
    c.beginPath(); c.ellipse(0, 12, 11, 5.6, 0, 0, Math.PI * 2); c.fill();                    // туловище
    c.beginPath(); c.ellipse(5.6, 8, 6, 5, 0, 0, Math.PI * 2); c.fill();                      // горб на холке
    c.fillStyle = shade(col, -0.2); c.beginPath(); c.ellipse(-2, 15, 8, 2.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(9, 7); c.quadraticCurveTo(13, 2, 15, 3); c.lineTo(17, 7); c.quadraticCurveTo(14, 10, 12, 14); c.fill();   // шея
    ellipse(c, 17.6, 5.8, 3.8, 2.4, col);                                                    // голова
    c.fillStyle = shade(col, 0.1); c.beginPath(); c.moveTo(18, 7); c.quadraticCurveTo(22, 9, 21, 11.6); c.quadraticCurveTo(18, 10.6, 16, 8); c.fill();   // нависающая морда
    ellipse(c, 21, 10.4, 1.2, 0.9, '#2a1a10');
    c.fillStyle = '#1a1210'; c.fillRect(17, 4.6, 0.7, 0.7);
    c.fillStyle = shade(col, -0.25); c.beginPath(); c.moveTo(15.6, 8); c.lineTo(15.2, 12.6); c.lineTo(17, 8.6); c.fill();                      // «серёжка» под горлом
    c.fillStyle = '#6a4a30'; c.beginPath(); c.moveTo(14.6, 3.4); c.lineTo(13.8, 0.6); c.lineTo(16, 3); c.fill();                                // ухо
    // рога: два плоских пятипалых «лопаты»
    const horn = (dx, flip) => {
      c.save(); c.translate(15.4 + dx, 3.2); c.scale(flip * 1.3, 1.3);
      c.fillStyle = '#c8b088'; c.strokeStyle = '#7a6444'; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-1.2, -3.6); c.lineTo(-5, -5); c.lineTo(-3.2, -6.4); c.lineTo(-6.8, -8.6); c.lineTo(-3, -9); c.lineTo(-4, -11.6); c.lineTo(0, -9.4); c.lineTo(3, -11.2); c.lineTo(2.6, -7.6); c.lineTo(6, -7.4); c.lineTo(3.6, -4.6); c.lineTo(5, -2.2); c.lineTo(1.2, -2.8); c.closePath(); c.fill(); c.stroke();
      c.restore();
    };
    horn(-0.6, 1); horn(2, -1);
    c.fillStyle = shade(col, -0.1); c.beginPath(); c.moveTo(-10, 9); c.lineTo(-13, 11); c.lineTo(-10, 12.4); c.fill();                           // хвостик
    if (load) { c.save(); c.translate(20, 12); c.scale(0.45, 0.45); drawLoad(c, load); c.restore(); }
    return;
  }
  if (kind === 'fox') {
    // лиса: рыжая, чёрные «носочки», белая грудка, пушистый хвост с белым кончиком
    const col = '#d8782a';
    crLegs(c, [-4, 4, -2.6, 5.4], 9, 5, f, '#2a1c14', 1.1);
    c.fillStyle = lingrad(c, 0, 4, 0, 12, [[0, shade(col, 0.15)], [1, shade(col, -0.2)]]);
    c.beginPath(); c.ellipse(0, 8, 7, 3.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(-6, 6); c.quadraticCurveTo(-13, 2, -13.4, 9); c.quadraticCurveTo(-9, 11, -6, 9); c.fill();         // хвост
    c.fillStyle = '#f6f0e4'; c.beginPath(); c.moveTo(-11.6, 4.4); c.quadraticCurveTo(-14.6, 6, -13.4, 9.4); c.lineTo(-11, 8); c.fill();            // белый кончик
    c.fillStyle = col; c.beginPath(); c.moveTo(4.6, 6.4); c.quadraticCurveTo(7, 2.6, 9, 3.4); c.lineTo(12.6, 5.4); c.lineTo(8.4, 7.8); c.quadraticCurveTo(7, 9.4, 5, 10.2); c.fill();   // голова
    c.fillStyle = '#f6f0e4'; c.beginPath(); c.moveTo(7, 8.4); c.lineTo(11.6, 6.2); c.lineTo(8.4, 9.6); c.fill();
    c.fillStyle = '#2a1c14'; c.beginPath(); c.moveTo(7.4, 3.6); c.lineTo(7.6, 0.4); c.lineTo(9.4, 3); c.fill();
    c.fillStyle = '#1a1210'; c.fillRect(12.2, 5.2, 0.8, 0.8); c.fillRect(9.6, 4.6, 0.6, 0.6);
    c.fillStyle = '#f6f0e4'; c.beginPath(); c.moveTo(6, 7.4); c.lineTo(8.4, 6.6); c.lineTo(7.6, 10.4); c.fill();
    if (load) { c.save(); c.translate(13, 8); c.scale(0.4, 0.4); drawLoad(c, load); c.restore(); }
    return;
  }
  if (kind === 'wolf') {
    const col = '#7a7470';
    crLegs(c, [-6, 5, -4.4, 6.6], 13, 8, f, col, 1.5);
    c.fillStyle = lingrad(c, 0, 6, 0, 16, [[0, shade(col, 0.1)], [1, '#4a4440']]);
    c.beginPath(); c.ellipse(0, 11, 9, 4.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = shade(col, -0.1); c.beginPath(); c.moveTo(-8, 9); c.quadraticCurveTo(-14, 8, -14, 13); c.quadraticCurveTo(-11, 11, -8, 12); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(6, 9); c.quadraticCurveTo(9, 5, 11.4, 6); c.lineTo(15.4, 8.4); c.lineTo(11.4, 10.4); c.quadraticCurveTo(9, 12, 7, 13); c.fill();
    c.fillStyle = shade(col, -0.25); c.beginPath(); c.moveTo(9.2, 6); c.lineTo(9.8, 2.6); c.lineTo(11, 5.6); c.fill();
    c.fillStyle = '#ffd060'; c.fillRect(11.6, 6.8, 0.7, 0.6);
    c.fillStyle = '#1a1210'; c.fillRect(15, 8, 0.8, 0.8);
    c.fillStyle = '#d8d0c8'; c.beginPath(); c.moveTo(7, 12); c.lineTo(9.6, 10); c.lineTo(9, 13); c.fill();
    if (load) { c.save(); c.translate(15.6, 10.6); c.scale(0.45, 0.45); drawLoad(c, load); c.restore(); }
    return;
  }
}

// Телега извозчика: лошадь, двухколёсная повозка, гном-возница, груз стопкой.
function drawCartRig(c, f, load, n) {
  const ph = f === null ? 0 : f / CR_N * Math.PI * 2;
  // повозка
  c.fillStyle = lingrad(c, 0, 14, 0, 22, [[0, '#a87848'], [1, '#5a3a1a']]);
  c.fillRect(-26, 14, 24, 7);
  c.strokeStyle = '#2e1a0a'; c.lineWidth = 0.5; c.strokeRect(-26, 14, 24, 7);
  for (let k = 1; k < 4; k++) line(c, -26 + k * 6, 14, -26 + k * 6, 21, 'rgba(30,15,5,0.5)', 0.4);
  line(c, -2, 18, 6, 17, '#5a3a1e', 1.1);
  // груз стопкой
  if (load) for (let k = 0; k < Math.min(n, 5); k++) {
    c.save(); c.translate(-20 + (k % 3) * 6.5, 11 - Math.floor(k / 3) * 4.4); c.scale(0.62, 0.62); drawLoad(c, load); c.restore();
  }
  // колесо с вращающимися спицами
  ellipse(c, -14, 23, 5.4, 5.4, '#2e1a0a'); ellipse(c, -14, 23, 4.4, 4.4, '#7a5030');
  c.strokeStyle = '#2e1a0a'; c.lineWidth = 0.6;
  for (let a = 0; a < 6; a++) { const t = a / 6 * Math.PI * 2 + ph * 0.5; c.beginPath(); c.moveTo(-14, 23); c.lineTo(-14 + Math.cos(t) * 4.2, 23 + Math.sin(t) * 4.2); c.stroke(); }
  ellipse(c, -14, 23, 1, 1, '#2a1a0a');
  // лошадь
  const col = '#7a4a2a';
  crLegs(c, [6, 18, 7.6, 19.6], 17, 11, f, col, 1.9);
  c.fillStyle = lingrad(c, 0, 9, 0, 20, [[0, shade(col, 0.2)], [1, shade(col, -0.3)]]);
  c.beginPath(); c.ellipse(12.6, 14, 9, 4.8, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(18, 12); c.quadraticCurveTo(21, 4, 23, 3); c.lineTo(25, 5); c.quadraticCurveTo(22, 9, 21, 15); c.fill();
  c.beginPath(); c.ellipse(25, 5, 3.6, 2, 0.5, 0, Math.PI * 2); c.fill();
  ellipse(c, 27.6, 7, 1.2, 1, shade(col, -0.2));
  c.fillStyle = '#1a1210'; c.fillRect(24.4, 3.6, 0.7, 0.7);
  c.fillStyle = '#2a1a10'; c.beginPath(); c.moveTo(19, 9); c.quadraticCurveTo(21, 3, 23.4, 1.6); c.lineTo(22, 5); c.quadraticCurveTo(20.6, 9, 20, 12); c.fill();
  c.beginPath(); c.moveTo(3.6, 12); c.quadraticCurveTo(0.6, 16, 2, 21); c.lineTo(3.6, 15); c.fill();
  // упряжь
  line(c, 6, 13, 22, 9, '#3a2414', 0.6); line(c, 21, 10, 25, 6, '#3a2414', 0.5);
  // возница — гном в колпаке
  c.fillStyle = '#6a5a4a'; c.beginPath(); c.ellipse(-4, 11, 3, 3.6, 0, 0, Math.PI * 2); c.fill();
  ellipse(c, -3.6, 5.6, 2.6, 2.6, SKINS[0][0]);
  c.fillStyle = '#e8e2d8'; c.beginPath(); c.moveTo(-3.6, 6.6); c.quadraticCurveTo(-2.4, 10.6, -0.8, 8.6); c.lineTo(-1, 6.4); c.fill();
  ellipse(c, -1.2, 6, 0.9, 0.8, SKINS[0][1]);
  c.fillStyle = lingrad(c, -6, 0, -1, 0, [[0, '#7a7a9a'], [1, '#3a3a5a']]);
  c.beginPath(); c.moveTo(-6.2, 4.6); c.quadraticCurveTo(-5.6, -1, -3, -2.4); c.quadraticCurveTo(-5.6, -4, -8.4, -2.2); c.quadraticCurveTo(-3.4, -2.6, -1, 4.2); c.closePath(); c.fill();
  line(c, -1.6, 10, 6, 12, '#3a2414', 0.4);
}

// Кадров ходьбы: мелкая живность 6, крупные звери и упряжка 8 (стандарт кадров, КАДРЫ.md)
const CR_FRAMES = { rabbit: 6, chicken: 6, duck: 6, goose: 6 };
let CR_N = 8;
const crFrames = kind => CR_FRAMES[kind] || 8;

function creatureSprite(kind, f, load, n = 1, view = 'E') {
  const key = kind + '|' + f + '|' + (load || '') + '|' + n + '|' + view;
  let cv = CR_CACHE.get(key);
  if (cv) return cv;
  const [w, h, ax, ay] = CR_SIZE[kind];
  CR_N = crFrames(kind);
  // перенос так, чтобы копыта/колёса стояли в точке (ax, ay)
  const oy = ay - { henbuff: 28, cart: 28, packgoat: 24, goat: 22, deer: 29, wolf: 21, rabbit: 11, chicken: 13, goose: 20.6, elk: 29, fox: 14, duck: 13 }[kind];
  const paint = c => { if (kind === 'cart') { if (view === 'E') drawCartRig(c, f, load, n); else drawCartFront(c, f, load, n, view); } else drawCreature(c, kind, f, load); };
  if (afFine()) cv = AK_CR[kind] && view === 'E' ? AK_CR[kind](f, load, n) : afVec(w, h, ax, oy, paint);   // мелкий пиксель ×3: ручной пиксель-арт (animalpx.js) или вектор, сведённый втрое детальнее
  else { const [c2, c] = mkSprite(w, h, 3); c.translate(ax, oy); paint(c); cv = c2; }
  CR_CACHE.set(key, cv);
  return cv;
}

// Нарисовать зверя/упряжку ступнями в точке (px, py)
function drawCreatureAt(c, kind, px, py, face, moving, phase, load, n, view = 'E') {
  if (kind === 'chicken' && load && load[0] === 'B') { kind = 'henbuff'; load = load.slice(1); moving = false; }   // месть кур: на накачанных ногах
  const f = moving ? Math.floor(phase * crFrames(kind) / 4) % crFrames(kind) : null;   // период шага прежний (4), кадров больше
  const spr = creatureSprite(kind, f, load, n, view);
  const [w, h, ax, ay] = CR_SIZE[kind];
  c.fillStyle = 'rgba(10,8,4,0.3)';
  c.beginPath(); c.ellipse(px + 1, py, w * 0.32, 2.2, 0, 0, 7); c.fill();
  c.imageSmoothingEnabled = !spr.fine;
  if (face < 0) { c.save(); c.translate(px, py); c.scale(-1, 1); afBlit(c, spr, -ax, -ay, w, h); c.restore(); }
  else afBlit(c, spr, px - ax, py - ay, w, h);
  c.imageSmoothingEnabled = R.smooth;
}

// Телега спереди (едет к нам) и сзади (едет от нас): вид сверху-под углом, центр по x = 0.
function drawCartFront(c, f, load, n, dir) {
  const south = dir === 'S';
  const lift = f === null ? [0, 0] : [Math.max(0, Math.sin(f / CR_N * Math.PI * 2)) * 1.6, Math.max(0, -Math.sin(f / CR_N * Math.PI * 2)) * 1.6];
  const col = '#7a4a2a';
  const wheel = x => { ellipse(c, x, 22, 1.7, 5.6, '#2e1a0a'); ellipse(c, x, 22, 1.1, 4.6, '#7a5030'); line(c, x, 17.8, x, 26.2, '#2e1a0a', 0.5); };
  const box = y0 => {
    c.fillStyle = lingrad(c, 0, y0, 0, y0 + 10, [[0, '#b88a56'], [1, '#6a4422']]);
    c.fillRect(-8, y0, 16, 10); c.strokeStyle = '#2e1a0a'; c.lineWidth = 0.5; c.strokeRect(-8, y0, 16, 10);
    for (let k = 1; k < 3; k++) line(c, -8, y0 + k * 3.3, 8, y0 + k * 3.3, 'rgba(30,15,5,0.5)', 0.4);
  };
  const stack = y0 => {
    if (!load) return;
    for (let k = 0; k < Math.min(n, 5); k++) { c.save(); c.translate(-5.4 + (k % 3) * 5.4, y0 - Math.floor(k / 3) * 4.2); c.scale(0.62, 0.62); drawLoad(c, load); c.restore(); }
  };
  const gnome = (x, y, back) => {
    c.fillStyle = '#6a5a4a'; c.beginPath(); c.ellipse(x, y + 5, 3.4, 3.4, 0, 0, Math.PI * 2); c.fill();
    ellipse(c, x, y + 0.4, 2.7, 2.7, back ? shade(SKINS[0][0], -0.1) : SKINS[0][0]);
    if (!back) { c.fillStyle = '#e8e2d8'; c.beginPath(); c.moveTo(x - 2.4, y + 1.6); c.quadraticCurveTo(x, y + 6, x + 2.4, y + 1.6); c.fill(); c.fillStyle = '#1a1210'; c.fillRect(x - 1.4, y, 0.7, 0.7); c.fillRect(x + 0.8, y, 0.7, 0.7); }
    c.fillStyle = lingrad(c, x - 3, 0, x + 3, 0, [[0, '#7a7a9a'], [1, '#3a3a5a']]);
    c.beginPath(); c.moveTo(x - 3.2, y - 1.4); c.quadraticCurveTo(x - 1, y - 7, x + 1.4, y - 8.4); c.quadraticCurveTo(x + 2.4, y - 5, x + 3.2, y - 1.4); c.closePath(); c.fill();
  };
  if (south) {
    wheel(-9.6); wheel(9.6);
    box(8); stack(7); gnome(0, 2, false);
    // лошадь мордой к нам: грудь, шея, голова, две передние ноги
    crLegs(c, [-2.7, 2.7], 19, 8 + 1, f, col, 2);
    c.fillStyle = lingrad(c, 0, 10, 0, 24, [[0, shade(col, 0.2)], [1, shade(col, -0.3)]]);
    c.beginPath(); c.ellipse(0, 18, 5.8, 6.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(-2.8, 15); c.quadraticCurveTo(-3.4, 8, -2.4, 6); c.lineTo(2.4, 6); c.quadraticCurveTo(3.4, 8, 2.8, 15); c.fill();
    c.fillStyle = '#2a1a10'; c.fillRect(-0.8, 5, 1.6, 9);
    c.fillStyle = shade(col, 0.1); c.beginPath(); c.ellipse(0, 7.4, 2.4, 3.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = shade(col, -0.2); c.beginPath(); c.moveTo(-2.4, 5); c.lineTo(-3.4, 2); c.lineTo(-1.4, 4.4); c.fill(); c.beginPath(); c.moveTo(2.4, 5); c.lineTo(3.4, 2); c.lineTo(1.4, 4.4); c.fill();
    ellipse(c, 0, 10, 1.7, 1.2, '#9a7a62'); c.fillStyle = '#1a1210'; c.fillRect(-1.6, 6.4, 0.7, 0.7); c.fillRect(0.9, 6.4, 0.7, 0.7);
    line(c, -3, 13, 3, 13, '#3a2414', 0.6);
  } else {
    // лошадь впереди (дальше от нас) — видна круп и хвост, телега с возницей перекрывает её
    c.fillStyle = lingrad(c, 0, 6, 0, 18, [[0, shade(col, 0.2)], [1, shade(col, -0.3)]]);
    c.beginPath(); c.ellipse(0, 8, 6.8, 5, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = shade(col, -0.35); c.beginPath(); c.moveTo(-2.6, 3.4); c.lineTo(-3.4, 0.6); c.lineTo(-1.4, 2.6); c.fill(); c.beginPath(); c.moveTo(2.6, 3.4); c.lineTo(3.4, 0.6); c.lineTo(1.4, 2.6); c.fill();
    c.fillStyle = '#2a1a10'; c.beginPath(); c.moveTo(-1.4, 11); c.quadraticCurveTo(-2.6, 18, -1.2, 22); c.lineTo(1.2, 22); c.quadraticCurveTo(2.6, 18, 1.4, 11); c.fill();
    crLegs(c, [-4.2, 4.2], 12, 7, f, col, 1.8);
    wheel(-9.6); wheel(9.6);
    box(18); stack(17); gnome(0, 10, true);
  }
}
