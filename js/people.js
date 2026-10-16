'use strict';
// Жители в духе Knights and Merchants: реалистичные пропорции, три ракурса
// (лицом S, спиной N, боком E), шаг в 8 кадров, работа с инструментом,
// детальная ноша. Курьеры носят груз на заплечной раме.
// Спрайт 26×38 мировых пикселей, ступни в точке (13, 35), рисуется ×3.

const PS = 3;
const PW = 26, PH = 38, PFX = 13, PFY = 35;

const SKINS = [['#f0c8a0', '#d8a47c', '#a87050'], ['#dcae84', '#c08c62', '#8a5a3a'], ['#b8845c', '#9a6a44', '#6a4428']];
const HAIRS = ['#2a1a10', '#4a2c18', '#6e4428', '#9a6a3a', '#c8a060', '#7a7268', '#8c3a1e'];

const OUTFIT = {
  serf:       { shirt: '#9a6436', pants: '#5a4630', hat: null, frame: true },
  builder:    { shirt: '#5a6a7a', pants: '#4a3a2a', hat: 'cap', hatC: '#6a4a2a', apron: '#8a6a44', belt: 'hammer' },
  woodcutter: { shirt: '#4a6a30', pants: '#4a3a28', hat: 'hood', hatC: '#6a4a26' },
  carpenter:  { shirt: '#b08a50', pants: '#4a3a2a', hat: 'cap', hatC: '#7a4a20', apron: '#c8a878' },
  stonemason: { shirt: '#7a7a7e', pants: '#3a3a3e', hat: 'cap', hatC: '#55555c', apron: '#8a6a44' },
  farmer:     { shirt: '#d8ccb0', pants: '#6a5434', hat: 'straw', hatC: '#e0cc78', vest: '#6a4a2a' },
  miller:     { shirt: '#e8e2d4', pants: '#b4aca0', hat: 'floppy', hatC: '#f0ece4' },
  baker:      { shirt: '#ece6da', pants: '#8a8070', hat: 'toque', hatC: '#ffffff', apron: '#ffffff' },
  miner:      { shirt: '#5a5048', pants: '#3a3430', hat: 'helmet', hatC: '#7a7470' },
  smelter:    { shirt: '#8a3a26', pants: '#3a2c24', hat: 'band', hatC: '#3a2014', apron: '#4a2c18' },
  breeder:    { shirt: '#6a7a3a', pants: '#4a3a28', hat: 'wide', hatC: '#5a3a1e' },
  butcher:    { shirt: '#e4dcc8', pants: '#4a3a30', hat: null, apron: '#f0ece4', blood: true, bald: true },
  tanner:     { shirt: '#8a6a44', pants: '#3e2e20', hat: 'cap', hatC: '#4a2c18', apron: '#5a3a1e' },
  armorer:    { shirt: '#6a6a74', pants: '#3a3632', hat: 'cap', hatC: '#3a3632', vest: '#4a4a52', rivets: true },
  enchanter:  { shirt: '#4c3080', pants: '#2a1a40', hat: 'wizard', hatC: '#4c3080', robe: true },
};

const ANIM_TOOL = { chop: 'axe', mine: 'pick', build: 'hammer', reap: 'sickle', dig: 'spade' };

function lookOf(u) {
  const l = u.look;
  const O = OUTFIT[u.type];
  return {
    skin: l % 3,
    hair: (l >> 2) % HAIRS.length,
    beard: u.type === 'enchanter' ? 2 : (l >> 5) % 3,
    bald: O.bald || (l >> 7) % 7 === 0,
    long: (l >> 9) % 5 === 0,
  };
}

// ---------- Ноша ----------
// Рисуется вокруг (0,0) — центра груза, примерно 11×9 пикселей.

function drawLoad(c, g) {
  const ol = 'rgba(20,10,4,0.75)';
  c.lineWidth = 0.35; c.strokeStyle = ol;
  switch (g) {
    case 'trunk':
      c.fillStyle = lingrad(c, 0, -2.4, 0, 2.4, [[0, '#9a6a3a'], [1, '#4a2c14']]);
      c.fillRect(-6.5, -2.2, 12, 4.4); c.strokeRect(-6.5, -2.2, 12, 4.4);
      for (let k = 0; k < 6; k++) line(c, -6 + k * 2, -1.6 + (k % 2), -4.5 + k * 2, -1.6 + (k % 2), 'rgba(30,15,5,0.6)', 0.3);
      ellipse(c, 5.5, 0, 1.6, 2.2, '#5a3a1c'); ellipse(c, 5.5, 0, 1.2, 1.8, '#dcb27a');
      c.strokeStyle = 'rgba(140,90,40,0.8)'; c.beginPath(); c.ellipse(5.5, 0, 0.6, 1, 0, 0, 7); c.stroke();
      break;
    case 'timber':
      for (let k = 0; k < 3; k++) {
        c.fillStyle = shade('#d8a45a', -k * 0.12); c.fillRect(-6, -2.6 + k * 1.7, 12, 1.6);
        c.fillStyle = 'rgba(80,40,10,0.5)'; c.fillRect(-6, -1.1 + k * 1.7, 12, 0.2);
      }
      c.strokeRect(-6, -2.6, 12, 5.1);
      c.fillStyle = '#c8b890'; c.fillRect(-3.5, -2.8, 0.6, 5.5); c.fillRect(2.8, -2.8, 0.6, 5.5);
      break;
    case 'stone':
      poly(c, [[-3.6, 2.6], [-4, -1.6], [-2.4, -3], [2.6, -3], [4, -1.4], [3.6, 2.6]], '#a49c90', ol, 0.35);
      poly(c, [[-4, -1.6], [-2.4, -3], [2.6, -3], [2, -1.4]], '#cec6ba');
      line(c, -1, 0, 1.2, 1.2, 'rgba(60,50,40,0.6)', 0.3);
      break;
    case 'wheat':
    case 'hay': {
      const col = g === 'wheat' ? '#d8b040' : '#a8a050';
      for (let k = -5; k <= 5; k++) { line(c, k * 0.5, 3.2, k * 1.1, -3.4, shade(col, (k % 3) * 0.08), 0.6); }
      if (g === 'wheat') for (let k = -5; k <= 5; k += 2) ellipse(c, k * 1.15, -3.8, 0.6, 1.2, '#f0d060');
      else ellipse(c, 0, -2.6, 5.4, 1.6, '#b8b060');
      line(c, -2.2, 0.6, 2.2, 0.6, '#8a5a2a', 0.8);
      break;
    }
    case 'flour':
      c.fillStyle = lingrad(c, -4, -3, 4, 3, [[0, '#fffdf6'], [1, '#c8c0b0']]);
      c.beginPath(); c.moveTo(-4, 3); c.quadraticCurveTo(-5, -1, -2, -3.4); c.lineTo(2, -3.4); c.quadraticCurveTo(5, -1, 4, 3); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#8a7050'; c.fillRect(-1.4, -3.8, 2.8, 0.8);
      break;
    case 'bread': case 'sausage': case 'goldore': case 'magicstone': {
      c.fillStyle = lingrad(c, -4.5, 0, 4.5, 0, [[0, '#c89a58'], [1, '#6a4a22']]);
      c.beginPath(); c.moveTo(-4.6, -0.6); c.lineTo(-3.6, 3); c.lineTo(3.6, 3); c.lineTo(4.6, -0.6); c.closePath(); c.fill(); c.stroke();
      for (let k = 0; k < 3; k++) line(c, -4.2, 0.4 + k, 4.2, 0.4 + k, 'rgba(70,45,15,0.6)', 0.25);
      if (g === 'bread') { ellipse(c, -2, -1, 2, 1.3, '#c8823a'); ellipse(c, 1.8, -1.2, 2.2, 1.4, '#b8742c'); line(c, 1, -1.8, 2.6, -0.8, '#f0c080', 0.3); }
      if (g === 'sausage') for (let k = -2; k <= 2; k++) ellipse(c, k * 1.5, -1 - Math.abs(k) * 0.2, 0.9, 1.6, k % 2 ? '#a83a2a' : '#8c2c20');
      if (g === 'goldore') for (let k = -2; k <= 2; k++) { ellipse(c, k * 1.6, -1, 1.2, 1, '#6e665c'); c.fillStyle = '#f6d458'; c.fillRect(k * 1.6 - 0.3, -1.4, 0.6, 0.6); }
      if (g === 'magicstone') { ellipse(c, 0, -1.5, 5, 3, 'rgba(160,110,255,0.35)'); for (const k of [-2, 0, 2]) poly(c, [[k - 0.9, -0.6], [k, -3.6 - Math.abs(k) * -0.2], [k + 0.9, -0.6]], '#9c7ae6', '#38245c', 0.25); }
      line(c, -4, -0.6, 0, -4.2, '#8a6a3a', 0.4); line(c, 0, -4.2, 4, -0.6, '#8a6a3a', 0.4);
      break;
    }
    case 'pig':
      ellipse(c, 0, 0, 5, 2.8, '#eaa8a8'); ellipse(c, 4.4, -0.8, 2, 1.8, '#eaa8a8'); ellipse(c, 6, -0.6, 0.8, 0.9, '#d08888');
      c.fillStyle = '#1a0a0a'; c.fillRect(4.6, -1.6, 0.4, 0.4);
      line(c, -2, 2, -2.6, 3.6, '#c07878', 0.6); line(c, 2, 2, 2.6, 3.6, '#c07878', 0.6);
      line(c, -1, -2.8, -1, 2.8, '#8a6a3a', 0.5); line(c, 1.6, -2.8, 1.6, 2.8, '#8a6a3a', 0.5);
      break;
    case 'gold':
      c.fillStyle = lingrad(c, 0, -3, 0, 3, [[0, '#8a5a30'], [1, '#4a2c14']]); c.fillRect(-4, -2, 8, 5); c.strokeRect(-4, -2, 8, 5);
      c.fillStyle = '#6a4424'; c.beginPath(); c.ellipse(0, -2, 4, 1.6, 0, Math.PI, 0); c.fill(); c.stroke();
      c.fillStyle = '#c89226'; c.fillRect(-4, -0.6, 8, 0.6); c.fillRect(-0.5, -1, 1, 1.6);
      break;
    case 'hide':
      poly(c, [[-5, -2], [5, -2.4], [5.6, 0.6], [4, 2.6], [-4.4, 2.6], [-5.6, 0.4]], '#c08a58', ol, 0.35);
      line(c, -4.6, -0.2, 5, -0.4, '#8a5a30', 0.4); line(c, -4.4, 1.2, 4.6, 1.2, '#a06a40', 0.3);
      break;
    case 'leather':
      c.fillStyle = lingrad(c, 0, -2.6, 0, 2.6, [[0, '#a8683c'], [1, '#5a3418']]); c.fillRect(-5.4, -2.4, 10.8, 4.8); c.strokeRect(-5.4, -2.4, 10.8, 4.8);
      ellipse(c, 5.4, 0, 1.2, 2.4, '#6a3c1e'); c.strokeStyle = '#c89a6a'; c.beginPath(); c.ellipse(5.4, 0, 0.6, 1.4, 0, 0, 7); c.stroke();
      c.fillStyle = '#3a2410'; c.fillRect(-2.5, -2.6, 0.8, 5.2); c.fillRect(1.6, -2.6, 0.8, 5.2);
      break;
    case 'leatherArmor':
      poly(c, [[-3.6, -3.4], [3.6, -3.4], [3.2, 3], [-3.2, 3]], '#875434', ol, 0.35);
      poly(c, [[-5, -3.4], [-3.4, -3.4], [-3.6, 0], [-5.2, -0.6]], '#6e4428'); poly(c, [[5, -3.4], [3.4, -3.4], [3.6, 0], [5.2, -0.6]], '#6e4428');
      c.fillStyle = '#45291a'; c.fillRect(-0.4, -3.4, 0.8, 6.4); c.fillRect(-3.4, 0.2, 6.8, 0.6);
      c.fillStyle = '#c89226'; c.fillRect(-2.4, -2, 0.6, 0.6); c.fillRect(1.8, -2, 0.6, 0.6);
      break;
    case 'mana':
      for (const k of [-2.6, 2.6]) {
        c.fillStyle = 'rgba(200,230,245,0.9)'; rrect(c, k - 2, -2.8, 4, 5.6, 1.2); c.fill(); c.stroke();
        c.fillStyle = '#3a8ad0'; c.fillRect(k - 1.6, -0.6, 3.2, 2.8);
        ellipse(c, k, -0.6, 1.6, 0.5, '#76c2f4');
        c.fillStyle = '#875434'; c.fillRect(k - 1, -3.8, 2, 1.1);
      }
      ellipse(c, 0, 0, 6, 4, 'rgba(90,170,255,0.18)');
      break;
    case 'staff':
      for (const k of [-1.2, 1.6]) {
        line(c, k - 1, 4.6, k + 1, -4.2, '#6e4428', 0.9);
        ellipse(c, k + 1.2, -4.8, 1.3, 1.3, '#9c7ae6'); ellipse(c, k + 0.9, -5.1, 0.5, 0.5, '#ffffff');
      }
      ellipse(c, 0.8, -4.8, 3.6, 2.4, 'rgba(160,110,255,0.25)');
      break;
    case 'mageArmor':
      c.fillStyle = lingrad(c, 0, -3, 0, 3, [[0, '#6440a8'], [1, '#2e1a50']]); rrect(c, -5, -2.8, 10, 5.6, 1.4); c.fill(); c.stroke();
      c.fillStyle = '#c89226'; c.fillRect(-5, -0.4, 10, 0.6);
      c.fillStyle = '#f6d458'; c.fillRect(-2.6, -1.8, 0.6, 0.6); c.fillRect(2.4, 1, 0.6, 0.6);
      break;
    default:
      c.fillStyle = GOODS[g] ? GOODS[g].color : '#f0f'; c.fillRect(-3, -3, 6, 6);
  }
}

// Деревянная заплечная рама курьера
function drawFrame(c, view, x, y) {
  const w = '#6a4424', d = '#3a2414';
  if (view === 'E') {
    line(c, x - 0.6, y - 4.6, x - 0.6, y + 5.2, d, 0.9);
    line(c, x - 3.2, y - 4.6, x - 3.2, y + 3.6, w, 0.8);
    line(c, x - 3.6, y + 3.4, x - 0.4, y + 3.4, w, 0.9);
  } else {
    line(c, x - 4, y - 4.6, x - 4, y + 5, view === 'N' ? w : d, 0.9);
    line(c, x + 4, y - 4.6, x + 4, y + 5, view === 'N' ? w : d, 0.9);
    line(c, x - 4.2, y + 3.4, x + 4.2, y + 3.4, w, 0.9);
    if (view === 'N') line(c, x - 4.2, y - 1, x + 4.2, y - 1, w, 0.7);
  }
}

// ---------- Тело ----------

// Конечность одной плавной линией: начало → (через сустав) → конец, сужается к концу.
function smoothLimb(c, a, k, b, w, col) {
  const cx = 2 * k[0] - (a[0] + b[0]) / 2, cy = 2 * k[1] - (a[1] + b[1]) / 2;
  const path = () => { c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(cx, cy, b[0], b[1]); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = shade(col, -0.5); c.lineWidth = w + 0.55; path(); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; path(); c.stroke();
  c.strokeStyle = shade(col, -0.2); c.lineWidth = w * 0.7;
  c.beginPath(); c.moveTo((k[0] + b[0]) / 2, (k[1] + b[1]) / 2); c.lineTo(b[0], b[1]); c.stroke();
  c.strokeStyle = shade(col, 0.2); c.lineWidth = w * 0.3;
  c.beginPath(); c.moveTo(a[0] - 0.3, a[1]); c.quadraticCurveTo(cx - 0.3, cy, (k[0] + b[0]) / 2 - 0.3, (k[1] + b[1]) / 2); c.stroke();
  c.lineCap = 'butt';
}

function limb(c, x0, y0, x1, y1, w, col) {
  smoothLimb(c, [x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2], [x1, y1], w, col);
}

function hand(c, x, y, col) {
  c.fillStyle = col;
  c.beginPath(); c.ellipse(x, y, 0.7, 0.85, 0, 0, Math.PI * 2); c.fill();
}

function boot(c, x, y, dir, col = '#2e1e12') {
  c.fillStyle = col;
  if (dir === 0) { rrect(c, x - 1.3, y - 1.6, 2.6, 1.9, 0.6); c.fill(); }
  else { rrect(c, x - (dir > 0 ? 1.1 : 2.1), y - 1.6, 3.2, 1.9, 0.7); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x - 1, y - 1.5, 1.4, 0.4);
}

function drawHead(c, view, hx, hy, L, O, type) {
  const sk = SKINS[L.skin];
  const hair = HAIRS[L.hair];
  const R = 2.7;
  // волосы сзади (длинные)
  if (!L.bald && L.long && view !== 'E') { c.fillStyle = hair; rrect(c, hx - 3, hy - 1, 6, 5.4, 1.6); c.fill(); }
  if (!L.bald && L.long && view === 'E') { c.fillStyle = hair; rrect(c, hx - 3.2, hy - 1.4, 3, 6, 1.4); c.fill(); }
  // шея
  c.fillStyle = sk[1]; c.fillRect(hx - 0.9, hy + 1.8, 1.8, 1.6);
  // голова
  c.fillStyle = radgrad(c, hx - 0.9, hy - 1, 0.4, R * 1.4, [[0, sk[0]], [0.7, sk[1]], [1, sk[2]]]);
  c.beginPath(); c.ellipse(hx, hy, R * 0.92, R, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(70,35,15,0.55)'; c.lineWidth = 0.3; c.stroke();
  if (view === 'S') {
    c.fillStyle = '#1a0e08'; c.fillRect(hx - 1.2, hy - 0.4, 0.6, 0.7); c.fillRect(hx + 0.6, hy - 0.4, 0.6, 0.7);
    c.fillStyle = shade(hair, -0.2); c.fillRect(hx - 1.4, hy - 1, 1, 0.35); c.fillRect(hx + 0.4, hy - 1, 1, 0.35);
    c.fillStyle = sk[2]; c.fillRect(hx - 0.25, hy + 0.2, 0.5, 0.9);
    c.fillStyle = '#8a4a3a'; c.fillRect(hx - 0.7, hy + 1.5, 1.4, 0.35);
    ellipse(c, hx - R * 0.9, hy + 0.2, 0.5, 0.8, sk[1]); ellipse(c, hx + R * 0.9, hy + 0.2, 0.5, 0.8, sk[2]);
  } else if (view === 'E') {
    c.fillStyle = '#1a0e08'; c.fillRect(hx + 1.1, hy - 0.4, 0.6, 0.7);
    c.fillStyle = shade(hair, -0.2); c.fillRect(hx + 0.8, hy - 1, 1.1, 0.35);
    ellipse(c, hx + R * 0.95, hy + 0.4, 0.6, 0.55, sk[1]);
    c.fillStyle = '#8a4a3a'; c.fillRect(hx + 1.3, hy + 1.5, 0.9, 0.3);
    ellipse(c, hx - 0.6, hy + 0.2, 0.55, 0.85, sk[2]);
  }
  // волосы
  if (!L.bald) {
    c.fillStyle = hair;
    if (view === 'N') { c.beginPath(); c.ellipse(hx, hy - 0.3, R * 0.95, R * 0.95, 0, 0, Math.PI * 2); c.fill(); }
    else if (view === 'E') { c.beginPath(); c.ellipse(hx - 0.7, hy - 0.9, R * 0.85, R * 0.75, -0.3, Math.PI * 0.7, Math.PI * 2.05); c.fill(); c.fillRect(hx - 2.6, hy - 1, 1.8, 2.4); }
    else { c.beginPath(); c.ellipse(hx, hy - 1.1, R * 0.95, R * 0.65, 0, Math.PI, Math.PI * 2); c.fill(); c.fillRect(hx - R * 0.92, hy - 1.2, 0.8, 1.8); c.fillRect(hx + R * 0.92 - 0.8, hy - 1.2, 0.8, 1.8); }
    c.fillStyle = shade(hair, 0.3); c.fillRect(hx - 1.2, hy - R + 0.4, 1.4, 0.4);
  } else if (view !== 'N') {
    ellipse(c, hx - 0.8, hy - 1.6, 0.9, 0.5, 'rgba(255,255,255,0.35)');
  }
  // борода
  if (L.beard && view !== 'N') {
    const bc = type === 'enchanter' ? '#e8e2d8' : hair;
    const long = L.beard === 2;
    c.fillStyle = bc;
    if (view === 'S') {
      c.beginPath(); c.moveTo(hx - 2.2, hy + 0.6); c.quadraticCurveTo(hx - 2, hy + (long ? 4.6 : 3.2), hx, hy + (long ? (type === 'enchanter' ? 7 : 4.8) : 3.4));
      c.quadraticCurveTo(hx + 2, hy + (long ? 4.6 : 3.2), hx + 2.2, hy + 0.6); c.lineTo(hx + 1.1, hy + 1.2); c.lineTo(hx - 1.1, hy + 1.2); c.closePath(); c.fill();
      c.fillStyle = shade(bc, 0.25); c.fillRect(hx - 1.2, hy + 1, 2.4, 0.4);
      c.fillStyle = '#8a4a3a'; c.fillRect(hx - 0.6, hy + 1.5, 1.2, 0.3);
    } else {
      c.beginPath(); c.moveTo(hx - 0.4, hy + 0.8); c.quadraticCurveTo(hx + 0.2, hy + (long ? (type === 'enchanter' ? 6.6 : 4.6) : 3.3), hx + 2.3, hy + (long ? 3.6 : 2.4)); c.lineTo(hx + 2.4, hy + 0.9); c.closePath(); c.fill();
    }
  }
  // головные уборы
  const hc = O.hatC, e = view === 'E';
  switch (O.hat) {
    case 'cap':
      c.fillStyle = lingrad(c, hx - 3, 0, hx + 3, 0, [[0, shade(hc, 0.2)], [1, shade(hc, -0.3)]]);
      c.beginPath(); c.ellipse(hx, hy - 1.3, R * 0.98, R * 0.72, 0, Math.PI, Math.PI * 2); c.fill();
      c.fillStyle = shade(hc, -0.35);
      if (e) c.fillRect(hx, hy - 1.5, 3.2, 0.7); else c.fillRect(hx - 2.8, hy - 1.5, 5.6, 0.6);
      break;
    case 'hood':
      c.fillStyle = lingrad(c, hx - 3.5, 0, hx + 3.5, 0, [[0, shade(hc, 0.2)], [1, shade(hc, -0.35)]]);
      if (view === 'S') { c.beginPath(); c.moveTo(hx - 3.4, hy + 3.4); c.quadraticCurveTo(hx - 3.6, hy - 3.8, hx, hy - 3.6); c.quadraticCurveTo(hx + 3.6, hy - 3.8, hx + 3.4, hy + 3.4); c.lineTo(hx + 2.2, hy + 2.6); c.quadraticCurveTo(hx + 2.4, hy - 1.6, hx, hy - 2.2); c.quadraticCurveTo(hx - 2.4, hy - 1.6, hx - 2.2, hy + 2.6); c.closePath(); c.fill(); }
      else if (e) { c.beginPath(); c.moveTo(hx + 1.6, hy - 2.6); c.quadraticCurveTo(hx - 1, hy - 4, hx - 3.6, hy - 1); c.lineTo(hx - 4.6, hy + 1.4); c.lineTo(hx - 2.6, hy + 3.6); c.lineTo(hx - 0.2, hy + 2.6); c.quadraticCurveTo(hx - 1.8, hy - 1, hx + 1.6, hy - 2.6); c.fill(); }
      else { c.beginPath(); c.ellipse(hx, hy - 0.2, 3.3, 3.5, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(hx - 1.2, hy + 2.6); c.lineTo(hx, hy + 5.6); c.lineTo(hx + 1.2, hy + 2.6); c.fill(); }
      break;
    case 'straw':
      ellipse(c, hx, hy - 1.6, 4.8, 1.4, shade(hc, -0.25));
      ellipse(c, hx, hy - 1.9, 4.6, 1.2, hc);
      c.fillStyle = lingrad(c, hx - 2, 0, hx + 2, 0, [[0, shade(hc, 0.2)], [1, shade(hc, -0.2)]]);
      c.beginPath(); c.ellipse(hx, hy - 2.4, 2.4, 1.8, 0, Math.PI, Math.PI * 2); c.fill();
      c.fillStyle = '#8c2c20'; c.fillRect(hx - 2.4, hy - 2.6, 4.8, 0.5);
      break;
    case 'wide':
      ellipse(c, hx, hy - 1.6, 4.6, 1.3, shade(hc, -0.3));
      c.fillStyle = hc; c.beginPath(); c.ellipse(hx, hy - 2.3, 2.6, 2, 0, Math.PI, Math.PI * 2); c.fill();
      break;
    case 'floppy':
      c.fillStyle = hc; c.beginPath(); c.ellipse(hx - (e ? 0.8 : 0), hy - 1.6, 3.2, 2, e ? -0.3 : 0, Math.PI * 0.9, Math.PI * 2.1); c.fill();
      ellipse(c, hx - (e ? 2.6 : 0), hy - 2.6, 1.6, 1.2, hc);
      break;
    case 'toque':
      c.fillStyle = lingrad(c, hx - 2.6, 0, hx + 2.6, 0, [[0, '#ffffff'], [1, '#c8c4bc']]);
      c.fillRect(hx - 2.3, hy - 4.6, 4.6, 3.2);
      c.beginPath(); c.ellipse(hx, hy - 5.2, 3, 1.8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d8d4cc'; c.fillRect(hx - 2.4, hy - 1.8, 4.8, 0.8);
      break;
    case 'helmet':
      c.fillStyle = lingrad(c, hx - 3, 0, hx + 3, 0, [[0, '#a8a29a'], [1, '#4a4642']]);
      c.beginPath(); c.ellipse(hx, hy - 1.2, R * 1.02, R * 0.85, 0, Math.PI, Math.PI * 2); c.fill();
      c.fillStyle = '#3a3632'; c.fillRect(hx - 3, hy - 1.4, 6, 0.7);
      if (view !== 'N') { const lx = e ? hx + 1.6 : hx - 0.6; c.fillStyle = '#e8e0c8'; c.fillRect(lx, hy - 4.6, 1.1, 1.8); ellipse(c, lx + 0.55, hy - 5, 0.5, 0.8, '#ffd060'); ellipse(c, lx + 0.55, hy - 4.8, 1.8, 1.8, 'rgba(255,200,90,0.25)'); }
      break;
    case 'band':
      c.fillStyle = hc; c.fillRect(hx - 2.7, hy - 1.6, 5.4, 0.9);
      if (e) c.fillRect(hx - 3.6, hy - 1.4, 1.2, 1.6);
      break;
    case 'wizard': {
      ellipse(c, hx, hy - 1.5, 4.4, 1.3, shade(hc, -0.3));
      c.fillStyle = lingrad(c, hx - 2.6, 0, hx + 2.6, 0, [[0, shade(hc, 0.25)], [1, shade(hc, -0.35)]]);
      c.beginPath(); c.moveTo(hx - 2.6, hy - 1.6); c.quadraticCurveTo(hx - 1.2, hy - 6, hx - 0.4, hy - 8.4);
      c.quadraticCurveTo(hx - 2, hy - 10, hx - 3.6, hy - 9.6); c.quadraticCurveTo(hx + 0.6, hy - 9, hx + 1.2, hy - 6); c.lineTo(hx + 2.6, hy - 1.6); c.closePath(); c.fill();
      c.fillStyle = '#f6d458'; c.fillRect(hx - 0.8, hy - 4.4, 0.6, 0.6); c.fillRect(hx + 0.8, hy - 2.8, 0.5, 0.5);
      c.fillStyle = '#c89226'; c.fillRect(hx - 2.5, hy - 2.1, 5, 0.5);
      break;
    }
  }
}

// pose: 'idle' | 'walk' | 'work'; frame: 0..7 для шага, {anim, f} для работы
function drawPerson(c, type, L, view, pose, frame, carry) {
  const O = OUTFIT[type];
  const shirt = O.shirt, pants = O.pants;
  const ph = pose === 'walk' ? frame / 8 * Math.PI * 2 : 0;
  const sw = Math.sin(ph);
  const bob = pose === 'walk' ? -Math.abs(Math.cos(ph)) * 0.5 + 0.25 : 0;
  const courier = !!O.frame;
  const duck = pose === 'duck';
  const crouch = duck ? 2.6 : 0;
  // наклон корпуса вперёд: шаг, ноша, жатва и копка, пригибание в дверях
  let lean = 0;
  if (pose === 'walk') lean = carry ? 0.17 : 0.07;
  if (pose === 'work' && (frame.anim === 'reap' || frame.anim === 'dig')) lean = 0.32;
  if (duck) lean = 0.5;
  c.save();
  c.translate(PFX, PFY + bob);
  const hipY = -11.2 + crouch, shY = -19.6 + crouch, headY = -23.2 + crouch;
  const upper = fn => { c.save(); c.translate(0, hipY); c.rotate(lean); c.translate(0, -hipY); fn(); c.restore(); };

  if (view === 'E') {
    // ---------- вид сбоку (лицом вправо) ----------
    const legs = [{ th: -sw * 0.45, far: true }, { th: sw * 0.45, far: false }];
    const legPts = l => {
      if (duck) return l.far ? [2.6, hipY + 4.2, 0.6, -0.2] : [3.6, hipY + 4, 1.6, -0.2];
      const bend = pose === 'walk' ? Math.max(0, Math.sin(ph + (l.far ? Math.PI : 0) + Math.PI / 2)) * 0.7 : 0.05;
      const kx = Math.sin(l.th) * 5.6 + 0.3, ky = hipY + Math.cos(l.th) * 5.6;
      const ax = kx + Math.sin(l.th - bend) * 5.4 - 0.3, ay = ky + Math.cos(l.th - bend) * 5.4;
      return [kx, ky, ax, Math.min(ay, -0.2)];
    };
    const drawLeg = l => {
      const [kx, ky, ax, ay] = legPts(l);
      const col = l.far ? shade(pants, -0.3) : pants;
      if (!O.robe) smoothLimb(c, [0, hipY], [kx, ky], [ax, ay - 0.8], 2.2, col);
      boot(c, ax + 0.3, ay + 0.2, 1, l.far ? '#22160c' : '#3a2616');
    };
    // работа: обе руки держат инструмент
    const tool = pose === 'work' ? (ANIM_TOOL[frame.anim] || 'hammer') : null;
    // угол от вертикали вверх, плюс — вперёд: замах за голову → удар вперёд-вниз
    const swingA = tool === 'sickle' || tool === 'spade' ? [1.2, 1.7, 2.2, 2.6] : [-0.7, 0.2, 1.3, 2.1];
    const ang = tool ? swingA[frame.f] : 0;
    const armA = pose === 'walk' ? -sw * 0.6 : duck ? -0.5 : 0;
    // дальняя рука
    if (!tool && !carry) upper(() => {
      const ex = Math.sin(-armA) * 4.1, ey = shY + Math.cos(-armA) * 4.1;
      smoothLimb(c, [-0.2, shY], [ex, ey], [ex + 0.9, ey + 3.6], 1.6, shade(shirt, -0.35));
      hand(c, ex + 0.9, ey + 3.9, SKINS[L.skin][2]);
    });
    drawLeg(legs[0]);
    upper(() => {
      if (courier) drawFrame(c, 'E', -2.4, shY + 4);
      if (carry && courier) { c.save(); c.translate(-4.6, shY + 1); c.rotate(-Math.PI / 2 * (carry === 'trunk' || carry === 'timber' || carry === 'staff' ? 1 : 0)); drawLoad(c, carry); c.restore(); }
    });
    // туловище
    upper(() => { if (O.robe) {
      c.fillStyle = lingrad(c, -3, 0, 3, 0, [[0, shade(shirt, 0.25)], [1, shade(shirt, -0.4)]]);
      c.beginPath(); c.moveTo(-2, shY); c.lineTo(2.4, shY); c.quadraticCurveTo(3.4, -6, 3.8 + sw * 0.6, -0.4); c.lineTo(-3.4 + sw * 0.6, -0.4); c.quadraticCurveTo(-3, -6, -2, shY); c.fill();
      c.strokeStyle = 'rgba(20,10,30,0.6)'; c.lineWidth = 0.3; c.stroke();
      c.fillStyle = '#c89226'; c.fillRect(-3.2, -1.4, 7, 0.5);
    } });
    drawLeg(legs[1]);
    upper(() => {
    if (!O.robe) {
      c.fillStyle = lingrad(c, -2.4, 0, 2.6, 0, [[0, shade(shirt, 0.22)], [0.6, shirt], [1, shade(shirt, -0.35)]]);
      c.beginPath(); c.moveTo(-2, shY - 0.4); c.lineTo(2.2, shY - 0.4); c.quadraticCurveTo(2.8, -14, 2.7, hipY + 1.2); c.lineTo(-2.6, hipY + 1.2); c.quadraticCurveTo(-2.8, -15, -2, shY - 0.4); c.fill();
      c.strokeStyle = 'rgba(20,10,4,0.6)'; c.lineWidth = 0.3; c.stroke();
      line(c, 0.6, shY + 2, 0.4, hipY, 'rgba(0,0,0,0.12)', 0.4);
      if (O.vest) { c.fillStyle = O.vest; c.beginPath(); c.moveTo(-1.6, shY); c.lineTo(2, shY); c.lineTo(2.4, hipY + 0.4); c.lineTo(-2, hipY + 0.4); c.fill(); if (O.rivets) { c.fillStyle = '#cec6ba'; for (let k = 0; k < 3; k++) c.fillRect(1.2, shY + 1.6 + k * 2.2, 0.4, 0.4); } }
      if (O.apron) { c.fillStyle = lingrad(c, 0, shY + 2, 0, -4, [[0, O.apron], [1, shade(O.apron, -0.25)]]); c.beginPath(); c.moveTo(1.2, shY + 2.4); c.lineTo(2.9, shY + 2.4); c.quadraticCurveTo(3.4, -8, 3.2 + sw * 0.5, -4.4); c.lineTo(1.4, -4.4); c.closePath(); c.fill(); if (O.blood) { ellipse(c, 2.4, -10, 0.6, 0.9, '#9c2c20'); ellipse(c, 2.8, -7, 0.5, 0.6, '#ac3e2a'); } }
      c.fillStyle = '#2a1a0e'; c.fillRect(-2.6, hipY + 0.4, 5.4, 0.9);
      c.fillStyle = '#c8a050'; c.fillRect(1.6, hipY + 0.4, 0.8, 0.9);
      c.fillStyle = '#6a4424'; rrect(c, -2.4, hipY + 1.2, 1.6, 1.8, 0.4); c.fill();   // кошель
      if (O.belt === 'hammer') { line(c, -1.2, hipY + 1, -1.6, hipY + 4.4, '#6a4424', 0.6); c.fillStyle = '#6a6a70'; c.fillRect(-2.2, hipY + 0.6, 2, 1); }
    }
    if (courier) { line(c, -1.6, shY + 0.2, 1.8, hipY + 0.6, '#4a2c14', 0.6); }
    drawHead(c, 'E', 0.5, headY, L, O, type);
    // ближняя рука, инструмент или ноша
    if (tool) {
      const hx = 0.4 + Math.sin(ang) * 5, hy = shY - Math.cos(ang) * 5;
      const tx = hx + Math.sin(ang) * 7.5, ty = hy - Math.cos(ang) * 7.5;
      smoothLimb(c, [0.4, shY], [(0.4 + hx) / 2 + 0.8, (shY + hy) / 2 + 0.6], [hx, hy], 1.7, shirt);
      line(c, hx - (tx - hx) * 0.25, hy - (ty - hy) * 0.25, tx, ty, '#6e4428', 0.9);
      const nx = -(ty - hy) / 7.5, ny = (tx - hx) / 7.5;
      if (tool === 'axe') poly(c, [[tx, ty], [tx + nx * 2.6, ty + ny * 2.6], [tx + nx * 2.4 - (tx - hx) * 0.22, ty + ny * 2.4 - (ty - hy) * 0.22], [tx - (tx - hx) * 0.15, ty - (ty - hy) * 0.15]], '#b8bcc0', '#3a3a3e', 0.3);
      else if (tool === 'pick') { c.strokeStyle = '#8a8e92'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(tx - nx * 3.4, ty - ny * 3.4); c.quadraticCurveTo(tx + (tx - hx) * 0.08, ty + (ty - hy) * 0.08, tx + nx * 3.4, ty + ny * 3.4); c.stroke(); }
      else if (tool === 'hammer') { c.save(); c.translate(tx, ty); c.rotate(Math.atan2(ty - hy, tx - hx)); c.fillStyle = '#5c564f'; c.fillRect(-0.8, -1.8, 2, 3.6); c.fillStyle = '#9e958a'; c.fillRect(-0.8, -1.8, 2, 0.6); c.restore(); }
      else if (tool === 'sickle') { c.strokeStyle = '#d0d4d8'; c.lineWidth = 0.8; c.beginPath(); c.arc(tx + nx * 1.6, ty + ny * 1.6, 2, Math.atan2(ny, nx) + Math.PI * 0.2, Math.atan2(ny, nx) + Math.PI * 1.2); c.stroke(); }
      else { c.fillStyle = '#9e958a'; c.save(); c.translate(tx, ty); c.rotate(Math.atan2(ty - hy, tx - hx)); c.fillRect(0, -1.3, 2.6, 2.6); c.restore(); }
      hand(c, hx, hy, SKINS[L.skin][1]);
    } else if (carry && !courier) {
      c.save(); c.translate(-0.6, shY - 2.4); drawLoad(c, carry); c.restore();
      smoothLimb(c, [0.4, shY], [2.6, shY + 0.6], [2.2, shY - 2.4], 1.6, shirt); hand(c, 2.2, shY - 2.8, SKINS[L.skin][0]);
    } else {
      const ex = 0.4 + Math.sin(armA) * 4.1, ey = shY + Math.cos(armA) * 4.1;
      const fx = ex + (courier ? 0.5 : 1.2), fy = ey + 3.6;
      smoothLimb(c, [0.4, shY], [ex, ey], [fx, fy], 1.7, shirt);
      hand(c, fx, fy + 0.3, SKINS[L.skin][0]);
    }
    });
  } else {
    // ---------- вид спереди / сзади ----------
    const front = view === 'S';
    const lift = pose === 'walk' ? [Math.max(0, sw) * 1.4, Math.max(0, -sw) * 1.4] : [0, 0];
    // в этих ракурсах наклон — это лёгкий сдвиг корпуса вниз
    const dip = lean * 3;
    c.save(); c.translate(0, dip);
    if (carry && courier && front) { c.save(); c.translate(0, shY - 2.6); drawLoad(c, carry); c.restore(); }
    if (courier && front) drawFrame(c, 'S', 0, shY + 4);
    c.restore();
    // ноги
    for (const [k, side] of [[0, -1], [1, 1]]) {
      const x = side * 1.4, ay = -0.2 - lift[k];
      const kx = duck ? side * 2.6 : x * 1.02, ky = (hipY + ay) / 2;
      if (!O.robe) smoothLimb(c, [x, hipY + dip], [kx, ky], [x * 1.05, ay - 0.9], 2.2, side > 0 === front ? shade(pants, -0.25) : pants);
      boot(c, x * 1.05, ay + 0.2, 0, '#2e1e12');
    }
    c.save(); c.translate(0, dip);
    // руки
    const armSw = pose === 'walk' ? sw * 0.8 : 0;
    const arm = (side) => {
      const sx = side * 3.5, col = (side > 0) === front ? shade(shirt, -0.25) : shirt;
      if (carry && !courier) {
        smoothLimb(c, [sx, shY + 0.4], [side * 4.4, shY - 0.6], [side * 2.4, shY - 3], 1.6, col);
        hand(c, side * 2.4, shY - 3.4, SKINS[L.skin][(side > 0) === front ? 1 : 0]);
        return;
      }
      const hy = -11.6 + crouch + (side > 0 ? armSw : -armSw) * (front ? 1 : -1);
      smoothLimb(c, [sx, shY + 0.4], [side * 4.3, (shY + hy) / 2], [side * 4, hy], 1.65, col);
      hand(c, side * 4, hy + 0.5, SKINS[L.skin][(side > 0) === front ? 1 : 0]);
    };
    if (!front) { arm(-1); arm(1); }
    // туловище
    c.fillStyle = lingrad(c, -3.8, 0, 3.8, 0, front
      ? [[0, shade(shirt, 0.22)], [0.55, shirt], [1, shade(shirt, -0.32)]]
      : [[0, shade(shirt, 0.05)], [1, shade(shirt, -0.42)]]);
    c.beginPath();
    if (O.robe) { c.moveTo(-3.6, shY); c.lineTo(3.6, shY); c.lineTo(4.6, -0.4); c.lineTo(-4.6, -0.4); }
    else { c.moveTo(-3.6, shY); c.lineTo(3.6, shY); c.quadraticCurveTo(3.2, -15, 3.2, hipY + 1.4); c.lineTo(-3.2, hipY + 1.4); c.quadraticCurveTo(-3.2, -15, -3.6, shY); }
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(20,10,4,0.6)'; c.lineWidth = 0.3; c.stroke();
    if (O.robe) {
      c.fillStyle = '#c89226'; c.fillRect(-4.4, -1.4, 8.8, 0.5); if (front) c.fillRect(-0.3, shY, 0.6, 19);
      if (front) { c.fillStyle = '#f6d458'; c.fillRect(-2.4, -9, 0.6, 0.6); c.fillRect(2, -5, 0.6, 0.6); }
    } else {
      if (front) {
        c.fillStyle = shade(shirt, -0.3); c.beginPath(); c.moveTo(-1.2, shY); c.lineTo(0, shY + 1.6); c.lineTo(1.2, shY); c.fill();
        line(c, -1.6, shY + 3, -1.4, hipY, 'rgba(0,0,0,0.12)', 0.4);
        if (O.vest) { c.fillStyle = O.vest; c.fillRect(-3.2, shY + 0.4, 2.2, 8); c.fillRect(1, shY + 0.4, 2.2, 8); if (O.rivets) { c.fillStyle = '#cec6ba'; for (let k = 0; k < 3; k++) { c.fillRect(-2.4, shY + 2 + k * 2.2, 0.4, 0.4); c.fillRect(2, shY + 2 + k * 2.2, 0.4, 0.4); } } }
        if (O.apron) { c.fillStyle = lingrad(c, 0, shY + 2, 0, -3.6, [[0, O.apron], [1, shade(O.apron, -0.25)]]); c.beginPath(); c.moveTo(-2.4, shY + 2.4); c.lineTo(2.4, shY + 2.4); c.lineTo(2.8, -3.6); c.lineTo(-2.8, -3.6); c.closePath(); c.fill(); line(c, -2.4, shY + 2.4, -1.6, shY - 0.2, O.apron, 0.4); line(c, 2.4, shY + 2.4, 1.6, shY - 0.2, O.apron, 0.4); if (O.blood) { ellipse(c, -0.8, -9, 0.7, 1, '#9c2c20'); ellipse(c, 1.2, -6, 0.6, 0.7, '#ac3e2a'); } }
        if (courier) { line(c, -2.4, shY + 0.2, -2, hipY + 1, '#4a2c14', 0.7); line(c, 2.4, shY + 0.2, 2, hipY + 1, '#4a2c14', 0.7); }
      }
      c.fillStyle = '#2a1a0e'; c.fillRect(-3.3, hipY + 0.4, 6.6, 0.9);
      if (front) { c.fillStyle = '#c8a050'; c.fillRect(-0.5, hipY + 0.4, 1, 0.9); }
      // подол туники
      c.fillStyle = shade(shirt, -0.15); c.fillRect(-3.3, hipY + 1.3, 6.6, 1.4);
      if (O.belt === 'hammer' && front) { line(c, 2.6, hipY + 1, 2.8, hipY + 4.2, '#6a4424', 0.6); c.fillStyle = '#6a6a70'; c.fillRect(2, hipY + 0.4, 1.8, 1); }
    }
    if (front) { arm(-1); arm(1); }
    drawHead(c, view, 0, headY, L, O, type);
    if (courier && !front) {
      drawFrame(c, 'N', 0, shY + 3.6);
      if (carry) { c.save(); c.translate(0, shY + 1.4); drawLoad(c, carry); c.restore(); }
    }
    if (carry && !courier) { c.save(); c.translate(0, shY - 5); drawLoad(c, carry); c.restore(); }
    c.restore();
  }
  c.restore();
}

const PEOPLE_CACHE = new Map();

function personSprite(u, view, pose, frame) {
  const L = lookOf(u);
  const fkey = pose === 'work' ? `${frame.anim}${frame.f}` : frame;
  const key = `${u.type}|${L.skin}${L.hair}${L.beard}${L.bald ? 1 : 0}${L.long ? 1 : 0}|${view}${pose}${fkey}|${u.carry || ''}`;
  let cv = PEOPLE_CACHE.get(key);
  if (!cv) {
    const [c2, ctx] = mkSprite(PW, PH, PS);
    drawPerson(ctx, u.type, L, view, pose, frame, u.carry);
    cv = c2;
    PEOPLE_CACHE.set(key, cv);
  }
  return cv;
}

// Портрет для интерфейса: голова и плечи крупно.
const PORTRAIT_CACHE = new Map();
function portraitURL(type, look = 3) {
  const key = type + look;
  if (PORTRAIT_CACHE.has(key)) return PORTRAIT_CACHE.get(key);
  const spr = personSprite({ type, look, carry: null }, 'S', 'idle', 0);
  const cv = mkCanvas(48, 48);
  const c = cv.getContext('2d');
  c.fillStyle = '#2a1e14'; c.fillRect(0, 0, 48, 48);
  c.fillStyle = radgrad(c, 24, 18, 2, 34, [[0, '#5a4430'], [1, '#1a120a']]); c.fillRect(0, 0, 48, 48);
  c.imageSmoothingQuality = 'high';
  // область головы: x 6..20, y 1..19 мировых пикселей
  c.drawImage(spr, 5 * PS, 0, 16 * PS, 16 * PS, 0, 2, 48, 48);
  const url = cv.toDataURL();
  PORTRAIT_CACHE.set(key, url);
  return url;
}
