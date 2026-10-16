'use strict';
// Жители — гномы: коренастые, с крупной головой, носом-картошкой, бородой и
// колпаком цвета своей профессии. Три ракурса (S — лицом, N — спиной, E — боком),
// шаг в 8 кадров, работа с инструментом, перекур с трубкой, сон, хромота.
// Курьеры носят груз на заплечной раме.
// Спрайт 26×38 мировых пикселей, ступни в точке (13, 35), рисуется ×3.

const PS = 3;
const PW = 26, PH = 38, PFX = 13, PFY = 35;

const SKINS = [['#f2caa2', '#dca47e', '#b06e52'], ['#e2b088', '#c88a64', '#94583c'], ['#c08a62', '#a06a46', '#6e442a']];
const BEARDS = ['#f0ece4', '#cfc8bc', '#9a8e80', '#5a3a22', '#8c4a22', '#c8823a', '#3a2a1e', '#e8d090'];

// Колпак — цвет профессии. Одежда: туника, штаны, особые детали.
const OUTFIT = {
  serf:       { cap: '#b8662e', shirt: '#8a6a44', pants: '#5a4630', frame: true },
  builder:    { cap: '#d8a030', shirt: '#5a6a7a', pants: '#4a3a2a', apron: '#8a6a44', belt: 'hammer' },
  woodcutter: { cap: '#3e7a2a', shirt: '#6a4a2a', pants: '#4a3a28', belt: 'axe' },
  carpenter:  { cap: '#a8582a', shirt: '#c8a870', pants: '#4a3a2a', apron: '#d8b888' },
  stonemason: { cap: '#86868e', shirt: '#6a6a70', pants: '#3a3a3e', apron: '#8a6a44' },
  farmer:     { cap: '#e0c040', shirt: '#d8ccb0', pants: '#6a5434', vest: '#6a4a2a' },
  miller:     { cap: '#f0ece2', shirt: '#e8e2d4', pants: '#b4aca0', dusty: true },
  baker:      { cap: 'baker', shirt: '#ece6da', pants: '#8a8070', apron: '#ffffff' },
  miner:      { cap: '#4a4a6a', shirt: '#5a5048', pants: '#3a3430', candle: true },
  smelter:    { cap: '#c03a20', shirt: '#6a3a26', pants: '#3a2c24', apron: '#3a2414' },
  breeder:    { cap: '#7a9a3a', shirt: '#8a6a3a', pants: '#4a3a28' },
  butcher:    { cap: '#9c2018', shirt: '#e4dcc8', pants: '#4a3a30', apron: '#f0ece4', blood: true },
  tanner:     { cap: '#8a5a30', shirt: '#7a5a3a', pants: '#3e2e20', apron: '#5a3a1e' },
  armorer:    { cap: '#4a5068', shirt: '#6a6a74', pants: '#3a3632', vest: '#4a4a52', rivets: true },
  enchanter:  { cap: 'wizard', shirt: '#4c3080', pants: '#2a1a40', robe: true },
  hopgrower:  { cap: '#8ab048', shirt: '#6a7a4a', pants: '#4a3a28' },
  brewer:     { cap: '#c8902c', shirt: '#8a5a2a', pants: '#3e2e20', apron: '#a87848' },
  herder:     { cap: '#9ab070', shirt: '#7a6a4a', pants: '#4a3a28', staff: true },
  stableman:  { cap: '#7a4a3a', shirt: '#5a4a3a', pants: '#3a2c20' },
  carter:     { cap: '#5a5a7a', shirt: '#6a5a4a', pants: '#3a3020' },
};

const ANIM_TOOL = { chop: 'axe', mine: 'pick', build: 'hammer', reap: 'sickle', dig: 'spade' };

function lookOf(u) {
  const l = u.look;
  return {
    skin: l % 3,
    beard: u.type === 'enchanter' ? 0 : (l >> 2) % BEARDS.length,
    beardLen: u.type === 'enchanter' ? 2 : (l >> 5) % 3,      // 0 короткая, 1 средняя, 2 длинная
    braid: (l >> 7) % 4 === 0,
    capTip: ((l >> 9) % 3) - 1,                               // куда клонится кончик колпака
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
      for (let k = -5; k <= 5; k++) line(c, k * 0.5, 3.2, k * 1.1, -3.4, shade(col, (k % 3) * 0.08), 0.6);
      if (g === 'wheat') for (let k = -5; k <= 5; k += 2) ellipse(c, k * 1.15, -3.8, 0.6, 1.2, '#f0d060');
      else ellipse(c, 0, -2.6, 5.4, 1.6, '#b8b060');
      line(c, -2.2, 0.6, 2.2, 0.6, '#8a5a2a', 0.8);
      break;
    }
    case 'hops':
      for (const [x, y] of [[-3, -1], [0, -2], [3, -1], [-1.5, 1], [1.8, 1]]) { ellipse(c, x, y, 1.6, 2, '#8ab048'); ellipse(c, x - 0.4, y - 0.6, 0.7, 0.8, '#c8e080'); }
      line(c, -4, -3, 4, -3, '#5a3a1e', 0.5);
      break;
    case 'beer':
      c.fillStyle = lingrad(c, -4, 0, 4, 0, [[0, '#a87040'], [1, '#5a3418']]);
      c.beginPath(); c.ellipse(0, 0, 4, 3.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#2e2e30'; c.fillRect(-1.6, -3.2, 0.6, 6.4); c.fillRect(1.2, -3.2, 0.6, 6.4);
      ellipse(c, 4, 0, 1, 2.6, '#7a4a24'); ellipse(c, 4.2, 0, 0.4, 0.4, '#3a2410');
      break;
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
      if (g === 'magicstone') { ellipse(c, 0, -1.5, 5, 3, 'rgba(160,110,255,0.35)'); for (const k of [-2, 0, 2]) poly(c, [[k - 0.9, -0.6], [k, -3.6], [k + 0.9, -0.6]], '#9c7ae6', '#38245c', 0.25); }
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
      ellipse(c, 5.4, 0, 1.2, 2.4, '#6a3c1e');
      c.fillStyle = '#3a2410'; c.fillRect(-2.5, -2.6, 0.8, 5.2); c.fillRect(1.6, -2.6, 0.8, 5.2);
      break;
    case 'leatherArmor':
      poly(c, [[-3.6, -3.4], [3.6, -3.4], [3.2, 3], [-3.2, 3]], '#875434', ol, 0.35);
      poly(c, [[-5, -3.4], [-3.4, -3.4], [-3.6, 0], [-5.2, -0.6]], '#6e4428'); poly(c, [[5, -3.4], [3.4, -3.4], [3.6, 0], [5.2, -0.6]], '#6e4428');
      c.fillStyle = '#45291a'; c.fillRect(-0.4, -3.4, 0.8, 6.4); c.fillRect(-3.4, 0.2, 6.8, 0.6);
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
      break;
    case 'mageArmor':
      c.fillStyle = lingrad(c, 0, -3, 0, 3, [[0, '#6440a8'], [1, '#2e1a50']]); rrect(c, -5, -2.8, 10, 5.6, 1.4); c.fill(); c.stroke();
      c.fillStyle = '#c89226'; c.fillRect(-5, -0.4, 10, 0.6);
      break;
    default:
      c.fillStyle = GOODS[g] ? GOODS[g].color : '#f0f'; c.fillRect(-3, -3, 6, 6);
  }
}

// Деревянная заплечная рама курьера
function drawFrame(c, view, x, y) {
  const w = '#6a4424', d = '#3a2414';
  if (view === 'E') {
    line(c, x - 0.6, y - 4, x - 0.6, y + 4.4, d, 0.9);
    line(c, x - 3, y - 4, x - 3, y + 3, w, 0.8);
    line(c, x - 3.4, y + 2.8, x - 0.4, y + 2.8, w, 0.9);
  } else {
    line(c, x - 3.6, y - 4, x - 3.6, y + 4.4, view === 'N' ? w : d, 0.9);
    line(c, x + 3.6, y - 4, x + 3.6, y + 4.4, view === 'N' ? w : d, 0.9);
    line(c, x - 3.8, y + 2.8, x + 3.8, y + 2.8, w, 0.9);
    if (view === 'N') line(c, x - 3.8, y - 1, x + 3.8, y - 1, w, 0.7);
  }
}

// ---------- Части тела ----------

function smoothLimb(c, a, k, b, w, col) {
  const cx = 2 * k[0] - (a[0] + b[0]) / 2, cy = 2 * k[1] - (a[1] + b[1]) / 2;
  const path = () => { c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(cx, cy, b[0], b[1]); };
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = shade(col, -0.5); c.lineWidth = w + 0.55; path(); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; path(); c.stroke();
  c.strokeStyle = shade(col, 0.2); c.lineWidth = w * 0.3;
  c.beginPath(); c.moveTo(a[0] - 0.3, a[1]); c.quadraticCurveTo(cx - 0.3, cy, (k[0] + b[0]) / 2 - 0.3, (k[1] + b[1]) / 2); c.stroke();
  c.lineCap = 'butt';
}

function hand(c, x, y, col) {
  c.fillStyle = col;
  c.beginPath(); c.ellipse(x, y, 0.75, 0.85, 0, 0, Math.PI * 2); c.fill();
}

// Гномий сапог с чуть загнутым носком
function boot(c, x, y, dir, col = '#3a2616') {
  c.fillStyle = col;
  if (dir === 0) { rrect(c, x - 1.4, y - 1.8, 2.8, 2.1, 0.8); c.fill(); }
  else {
    c.beginPath(); c.moveTo(x - 1.2, y + 0.3); c.lineTo(x - 1.2, y - 1.8); c.lineTo(x + 1, y - 1.8);
    c.quadraticCurveTo(x + 2.6, y - 1.2, x + 2.6, y - 0.4); c.quadraticCurveTo(x + 3.2, y - 1.6, x + 3.1, y - 0.6); c.lineTo(x + 2.4, y + 0.3); c.closePath(); c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x - 1, y - 1.7, 1.4, 0.4);
}

function bandage(c, x0, y0, x1, y1) {
  c.lineCap = 'round';
  c.strokeStyle = '#f4f0e6'; c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.strokeStyle = 'rgba(180,40,30,0.7)'; c.lineWidth = 0.6;
  c.beginPath(); c.moveTo((x0 + x1) / 2 - 0.4, (y0 + y1) / 2); c.lineTo((x0 + x1) / 2 + 0.4, (y0 + y1) / 2 + 0.3); c.stroke();
  c.lineCap = 'butt';
}

// Колпак: от ободка на лбу до свисающего кончика.
function drawCap(c, O, view, hx, hy, tipSway, L) {
  const e = view === 'E';
  if (O.cap === 'baker') {
    // пышный поварской колпак, переходящий в острый гномий кончик
    const tip = e ? [hx - 4 + tipSway, hy - 14] : [hx + 3 + tipSway, hy - 14];
    c.fillStyle = lingrad(c, hx - 4, 0, hx + 4, 0, [[0, '#ffffff'], [1, '#c8c4bc']]);
    c.beginPath(); c.moveTo(hx - 1.6, hy - 8); c.quadraticCurveTo(hx - 0.6, hy - 12, tip[0], tip[1]); c.quadraticCurveTo(hx + 1.8, hy - 11, hx + 2, hy - 8); c.closePath(); c.fill();
    for (const [dx, dy, r] of [[-2.6, -5.6, 2.2], [0, -6.6, 2.6], [2.6, -5.6, 2.2], [-1.4, -4, 2.4], [1.4, -4, 2.4]]) ellipse(c, hx + dx, hy + dy, r, r * 0.9, '#f6f4ee');
    for (const [dx, dy] of [[-2.6, -5.6], [0, -6.6], [2.6, -5.6]]) ellipse(c, hx + dx - 0.6, hy + dy - 0.6, 0.9, 0.7, '#ffffff');
    c.fillStyle = '#d8d4cc'; rrect(c, hx - 3.6, hy - 3.2, 7.2, 1.8, 0.6); c.fill();
    ellipse(c, tip[0], tip[1], 0.9, 0.9, '#ffffff');
    return;
  }
  const wizard = O.cap === 'wizard';
  const col = wizard ? '#4c3080' : O.cap;
  const h = wizard ? 16 : 12.5;
  if (wizard) ellipse(c, hx, hy - 1.6, 4.8, 1.4, shade(col, -0.35));
  c.fillStyle = lingrad(c, hx - 4, 0, hx + 4, 0, [[0, shade(col, 0.28)], [0.55, col], [1, shade(col, -0.38)]]);
  c.beginPath();
  if (e) {
    // боком: кончик откинут назад
    c.moveTo(hx - 3.4, hy - 1);
    c.quadraticCurveTo(hx - 2.8, hy - h * 0.62, hx - 0.8, hy - h * 0.84);
    c.quadraticCurveTo(hx - 2.2 + tipSway, hy - h - 1, hx - 5.6 + tipSway, hy - h * 0.86);
    c.quadraticCurveTo(hx + 0.2, hy - h * 0.94, hx + 1.4, hy - h * 0.62);
    c.quadraticCurveTo(hx + 3, hy - h * 0.3, hx + 3.6, hy - 1.4);
  } else {
    const side = L.capTip || 1;
    c.moveTo(hx - 3.7, hy - 1.2);
    c.quadraticCurveTo(hx - 3, hy - h * 0.58, hx - 0.5 * side, hy - h * 0.84);
    c.quadraticCurveTo(hx + 1.6 * side + tipSway, hy - h - 1, hx + 4 * side + tipSway, hy - h * 0.9);
    c.quadraticCurveTo(hx + 2.2 * side, hy - h * 0.84, hx + 1.8 * side, hy - h * 0.66);
    c.quadraticCurveTo(hx + 3.4, hy - h * 0.36, hx + 3.7, hy - 1.2);
  }
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(20,10,4,0.55)'; c.lineWidth = 0.3; c.stroke();
  // складка и ободок
  c.strokeStyle = shade(col, -0.3); c.lineWidth = 0.4;
  c.beginPath(); c.moveTo(hx - 1, hy - 3); c.quadraticCurveTo(hx - 0.6, hy - h * 0.5, hx - 0.2, hy - h * 0.72); c.stroke();
  c.fillStyle = shade(col, -0.3); rrect(c, hx - 3.8, hy - 2.4, 7.6, 1.6, 0.6); c.fill();
  if (wizard) {
    c.fillStyle = '#f6d458'; c.fillRect(hx - 1, hy - 7, 0.7, 0.7); c.fillRect(hx + 1.2, hy - 10, 0.6, 0.6); c.fillRect(hx - 0.2, hy - 4, 0.5, 0.5);
    c.fillStyle = '#c89226'; c.fillRect(hx - 3.6, hy - 2.2, 7.2, 0.5);
  }
  if (O.candle && view !== 'N') {
    const cx = e ? hx + 2.4 : hx;
    c.fillStyle = '#b08a3a'; c.fillRect(cx - 0.8, hy - 3, 1.6, 0.8);
    c.fillStyle = '#efe6d0'; c.fillRect(cx - 0.5, hy - 5.4, 1, 2.4);
    ellipse(c, cx, hy - 6, 0.5, 0.8, '#ffd060');
    ellipse(c, cx, hy - 5.8, 2, 2, 'rgba(255,210,100,0.25)');
  }
  if (O.dusty) for (let k = 0; k < 4; k++) c.fillRect(hx - 2 + k * 1.2, hy - 4 - k, 0.4, 0.4);
}

function drawHead(c, view, hx, hy, L, O, type, pipe) {
  const sk = SKINS[L.skin];
  const bc = type === 'enchanter' ? '#f0ece4' : BEARDS[L.beard];
  const R = 3.4;
  // голова
  c.fillStyle = radgrad(c, hx - 1, hy - 1, 0.4, R * 1.4, [[0, sk[0]], [0.7, sk[1]], [1, sk[2]]]);
  c.beginPath(); c.ellipse(hx, hy, R * 0.94, R, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(70,35,15,0.5)'; c.lineWidth = 0.3; c.stroke();
  const bl = [3.2, 5, 7.4][L.beardLen];
  if (view === 'S') {
    ellipse(c, hx - R * 0.95, hy + 0.2, 0.6, 1, sk[1]); ellipse(c, hx + R * 0.95, hy + 0.2, 0.6, 1, sk[2]);
    // борода лопатой
    c.fillStyle = lingrad(c, hx - 3, 0, hx + 3, 0, [[0, shade(bc, 0.2)], [1, shade(bc, -0.25)]]);
    c.beginPath(); c.moveTo(hx - 3.2, hy - 0.2); c.quadraticCurveTo(hx - 3.6, hy + bl * 0.7, hx, hy + bl + 1);
    c.quadraticCurveTo(hx + 3.6, hy + bl * 0.7, hx + 3.2, hy - 0.2); c.quadraticCurveTo(hx, hy + 1.6, hx - 3.2, hy - 0.2); c.fill();
    c.strokeStyle = shade(bc, -0.3); c.lineWidth = 0.3;
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(hx + k * 0.9, hy + 1.8); c.lineTo(hx + k * 0.7, hy + bl * 0.85); c.stroke(); }
    if (L.braid) { c.fillStyle = shade(bc, -0.1); for (let k = 0; k < 3; k++) ellipse(c, hx, hy + bl + 1.6 + k * 1.2, 0.8, 0.7, shade(bc, -0.1 * k)); }
    // глаза, брови, щёки, нос-картошка, усы
    c.fillStyle = '#1a0e08'; c.fillRect(hx - 1.5, hy - 0.8, 0.6, 0.7); c.fillRect(hx + 0.9, hy - 0.8, 0.6, 0.7);
    c.fillStyle = shade(bc, -0.1); rrect(c, hx - 2.1, hy - 1.7, 1.6, 0.6, 0.3); c.fill(); rrect(c, hx + 0.5, hy - 1.7, 1.6, 0.6, 0.3); c.fill();
    ellipse(c, hx - 2, hy + 0.4, 0.9, 0.6, 'rgba(230,110,90,0.45)'); ellipse(c, hx + 2, hy + 0.4, 0.9, 0.6, 'rgba(230,110,90,0.45)');
    ellipse(c, hx, hy + 0.4, 1.25, 1.1, shade(sk[1], 0.05)); ellipse(c, hx - 0.4, hy + 0.1, 0.45, 0.35, 'rgba(255,240,220,0.6)');
    ellipse(c, hx - 1.2, hy + 1.6, 1.4, 0.7, shade(bc, 0.1)); ellipse(c, hx + 1.2, hy + 1.6, 1.4, 0.7, shade(bc, 0.05));
  } else if (view === 'E') {
    ellipse(c, hx - 0.8, hy + 0.2, 0.7, 1, sk[2]);   // ухо
    c.fillStyle = lingrad(c, hx - 1, 0, hx + 3.6, 0, [[0, shade(bc, -0.15)], [1, shade(bc, 0.15)]]);
    c.beginPath(); c.moveTo(hx - 0.6, hy + 0.4); c.quadraticCurveTo(hx - 0.2, hy + bl * 0.8, hx + 1.4, hy + bl + 0.6);
    c.quadraticCurveTo(hx + 3.6, hy + bl * 0.5, hx + 3.6, hy + 1); c.lineTo(hx + 1.6, hy + 0.6); c.closePath(); c.fill();
    c.strokeStyle = shade(bc, -0.3); c.lineWidth = 0.3;
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(hx + 0.6 + k, hy + 1.6); c.lineTo(hx + 0.6 + k * 0.8, hy + bl * 0.8); c.stroke(); }
    c.fillStyle = '#1a0e08'; c.fillRect(hx + 1.5, hy - 0.8, 0.6, 0.7);
    c.fillStyle = shade(bc, -0.1); rrect(c, hx + 1, hy - 1.7, 1.8, 0.6, 0.3); c.fill();
    ellipse(c, hx + 1.7, hy + 0.5, 0.8, 0.6, 'rgba(230,110,90,0.45)');
    ellipse(c, hx + 3.3, hy + 0.4, 1.2, 1.1, shade(sk[1], 0.05)); ellipse(c, hx + 3, hy + 0.1, 0.4, 0.35, 'rgba(255,240,220,0.6)');
    ellipse(c, hx + 2.6, hy + 1.6, 1.3, 0.6, shade(bc, 0.1));
    if (pipe) {
      line(c, hx + 2.8, hy + 1.8, hx + 5.6, hy + 2.6, '#4a2c14', 0.6);
      c.fillStyle = '#6a3c1c'; rrect(c, hx + 5, hy + 0.8, 1.6, 2.2, 0.4); c.fill();
      ellipse(c, hx + 5.8, hy + 0.9, 0.7, 0.3, 'rgba(255,140,40,0.9)');
    }
  } else {
    // спиной: только края бороды
    ellipse(c, hx - 3, hy + 1.6, 0.8, 1.6, bc); ellipse(c, hx + 3, hy + 1.6, 0.8, 1.6, bc);
  }
}

// pose: idle | walk | work | duck | smoke | tame; frame: 0..7 для шага, {anim, f} для работы
function drawPerson(c, type, L, view, pose, frame, carry, injury) {
  const O = OUTFIT[type] || OUTFIT.serf;
  const shirt = O.shirt, pants = O.pants;
  const ph = pose === 'walk' ? frame / 8 * Math.PI * 2 : 0;
  const sw = Math.sin(ph);
  const limp = injury === 'leg' && pose === 'walk';
  const bob = pose === 'walk' ? -Math.abs(Math.cos(ph)) * (limp ? 1.2 : 0.5) + 0.25 : 0;
  const courier = !!O.frame;
  const duck = pose === 'duck' || pose === 'tame';
  const crouch = duck ? 1.8 : 0;
  let lean = 0;
  if (pose === 'walk') lean = carry ? 0.17 : 0.06;
  if (limp) lean += sw > 0 ? 0.12 : -0.02;
  if (pose === 'work' && (frame.anim === 'reap' || frame.anim === 'dig')) lean = 0.3;
  if (duck) lean = 0.45;
  const tipSway = pose === 'walk' ? Math.sin(ph + 1) * 0.9 : 0;
  c.save();
  c.translate(PFX, PFY + bob);
  const hipY = -6.8 + crouch, shY = -12.6 + crouch, headY = -16.6 + crouch;
  const upper = fn => { c.save(); c.translate(0, hipY); c.rotate(lean); c.translate(0, -hipY); fn(); c.restore(); };
  const skin = SKINS[L.skin];

  if (view === 'E') {
    // ---------- боком, лицом вправо ----------
    const legs = [{ th: -sw * 0.5, far: true }, { th: sw * 0.5, far: false }];
    const legPts = l => {
      if (duck) return l.far ? [2.2, hipY + 2.8, 0.6, -0.2] : [3, hipY + 2.6, 1.4, -0.2];
      // хромой не сгибает больную (ближнюю) ногу
      const stiff = limp && !l.far;
      const bend = pose === 'walk' && !stiff ? Math.max(0, Math.sin(ph + (l.far ? Math.PI : 0) + Math.PI / 2)) * 0.7 : 0.05;
      const th = stiff ? l.th * 0.5 : l.th;
      const kx = Math.sin(th) * 3.5 + 0.3, ky = hipY + Math.cos(th) * 3.5;
      const ax = kx + Math.sin(th - bend) * 3.4 - 0.3, ay = ky + Math.cos(th - bend) * 3.4;
      return [kx, ky, ax, Math.min(ay, -0.2)];
    };
    const drawLeg = l => {
      const [kx, ky, ax, ay] = legPts(l);
      const col = l.far ? shade(pants, -0.3) : pants;
      if (!O.robe) smoothLimb(c, [0, hipY], [kx, ky], [ax, ay - 0.8], 2.4, col);
      if (injury === 'leg' && !l.far && !O.robe) bandage(c, kx, ky + 0.4, ax, ay - 1.4);
      boot(c, ax, ay + 0.2, 1, l.far ? '#22160c' : '#3a2616');
    };
    const tool = pose === 'work' ? (ANIM_TOOL[frame.anim] || 'hammer') : null;
    const swingA = tool === 'sickle' || tool === 'spade' ? [1.2, 1.7, 2.2, 2.6] : [-0.7, 0.2, 1.3, 2.1];
    const ang = tool ? swingA[frame.f] : 0;
    const armA = pose === 'walk' ? -sw * 0.6 : duck ? -0.5 : 0;
    const sling = injury === 'arm';
    // дальняя рука
    if (!tool && !carry && pose !== 'smoke') upper(() => {
      const ex = Math.sin(-armA) * 2.8, ey = shY + Math.cos(-armA) * 2.8;
      smoothLimb(c, [-0.2, shY], [ex, ey], [ex + 0.8, ey + 2.6], 1.7, shade(shirt, -0.35));
      hand(c, ex + 0.8, ey + 2.9, skin[2]);
    });
    drawLeg(legs[0]);
    upper(() => {
      if (courier) drawFrame(c, 'E', -2.6, shY + 3);
      if (carry && courier) { c.save(); c.translate(-4.6, shY); c.rotate(-Math.PI / 2 * (carry === 'trunk' || carry === 'timber' || carry === 'staff' ? 1 : 0)); drawLoad(c, carry); c.restore(); }
      if (O.staff) line(c, -2.4, shY + 6, -1, shY - 8, '#6a4424', 0.8);
    });
    drawLeg(legs[1]);
    upper(() => {
      // туловище с животиком
      c.fillStyle = lingrad(c, -3, 0, 3.2, 0, [[0, shade(shirt, 0.22)], [0.55, shirt], [1, shade(shirt, -0.35)]]);
      c.beginPath();
      if (O.robe) { c.moveTo(-2.2, shY - 0.4); c.lineTo(2.2, shY - 0.4); c.quadraticCurveTo(3.8, -5, 3.6 + sw * 0.6, -0.4); c.lineTo(-3.2 + sw * 0.6, -0.4); c.quadraticCurveTo(-3.2, -6, -2.2, shY - 0.4); }
      else { c.moveTo(-2.2, shY - 0.4); c.lineTo(2, shY - 0.4); c.quadraticCurveTo(4.4, shY + 3.4, 3, hipY + 1.6); c.lineTo(-2.8, hipY + 1.6); c.quadraticCurveTo(-3.2, shY + 3, -2.2, shY - 0.4); }
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(20,10,4,0.55)'; c.lineWidth = 0.3; c.stroke();
      if (O.robe) { c.fillStyle = '#c89226'; c.fillRect(-3.2, -1.4, 6.8, 0.5); c.fillStyle = '#f6d458'; c.fillRect(1.6, -6, 0.6, 0.6); }
      if (O.vest) { c.fillStyle = O.vest; c.beginPath(); c.moveTo(-1.6, shY); c.lineTo(1.8, shY); c.quadraticCurveTo(3.6, shY + 3, 2.6, hipY + 0.6); c.lineTo(-2.2, hipY + 0.6); c.fill(); if (O.rivets) { c.fillStyle = '#cec6ba'; for (let k = 0; k < 3; k++) c.fillRect(1.4, shY + 1.2 + k * 1.6, 0.4, 0.4); } }
      if (O.apron) { c.fillStyle = lingrad(c, 0, shY + 1, 0, -2.6, [[0, O.apron], [1, shade(O.apron, -0.25)]]); c.beginPath(); c.moveTo(1.2, shY + 2); c.lineTo(3.4, shY + 2.4); c.quadraticCurveTo(4.2, -5, 3.4 + sw * 0.4, -2.6); c.lineTo(1.4, -2.6); c.closePath(); c.fill(); if (O.blood) { ellipse(c, 2.6, -7.6, 0.6, 0.8, '#9c2c20'); ellipse(c, 3, -5, 0.5, 0.6, '#ac3e2a'); } }
      if (!O.robe) {
        c.fillStyle = '#2a1a0e'; c.fillRect(-2.8, hipY + 0.2, 6, 0.9);
        c.fillStyle = '#c8a050'; c.fillRect(2, hipY + 0.2, 0.9, 0.9);
        c.fillStyle = '#6a4424'; rrect(c, -2.6, hipY + 1, 1.5, 1.6, 0.4); c.fill();
        if (O.belt === 'hammer') { line(c, -1.4, hipY + 0.8, -1.8, hipY + 3.6, '#6a4424', 0.6); c.fillStyle = '#6a6a70'; c.fillRect(-2.4, hipY + 0.4, 1.8, 0.9); }
        if (O.belt === 'axe') { line(c, -1.6, hipY + 0.6, -2.4, hipY + 4, '#6a4424', 0.6); poly(c, [[-2.4, hipY + 3.6], [-3.8, hipY + 3.2], [-3.6, hipY + 4.8]], '#b8bcc0'); }
      }
      if (courier) line(c, -1.6, shY + 0.2, 2, hipY + 0.4, '#4a2c14', 0.6);
      drawHead(c, 'E', 0.6, headY, L, O, type, pose === 'smoke');
      drawCap(c, O, 'E', 0.6, headY - 1.4, tipSway, L);
      // ближняя рука
      if (sling) {
        poly(c, [[-0.4, shY + 0.6], [3, shY + 3.2], [-0.8, shY + 4.2]], '#f4f0e6', 'rgba(120,110,100,0.6)', 0.3);
        smoothLimb(c, [0.4, shY], [0.6, shY + 3], [2.6, shY + 3], 1.6, shirt);
        hand(c, 2.8, shY + 3, skin[0]);
      } else if (tool) {
        const hx = 0.4 + Math.sin(ang) * 3.8, hy = shY - Math.cos(ang) * 3.8;
        const tx = hx + Math.sin(ang) * 6.5, ty = hy - Math.cos(ang) * 6.5;
        smoothLimb(c, [0.4, shY], [(0.4 + hx) / 2 + 0.6, (shY + hy) / 2 + 0.5], [hx, hy], 1.7, shirt);
        line(c, hx - (tx - hx) * 0.25, hy - (ty - hy) * 0.25, tx, ty, '#6e4428', 0.9);
        const nx = -(ty - hy) / 6.5, ny = (tx - hx) / 6.5;
        if (tool === 'axe') poly(c, [[tx, ty], [tx + nx * 2.4, ty + ny * 2.4], [tx + nx * 2.2 - (tx - hx) * 0.22, ty + ny * 2.2 - (ty - hy) * 0.22], [tx - (tx - hx) * 0.15, ty - (ty - hy) * 0.15]], '#b8bcc0', '#3a3a3e', 0.3);
        else if (tool === 'pick') { c.strokeStyle = '#8a8e92'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(tx - nx * 3.2, ty - ny * 3.2); c.quadraticCurveTo(tx + (tx - hx) * 0.08, ty + (ty - hy) * 0.08, tx + nx * 3.2, ty + ny * 3.2); c.stroke(); }
        else if (tool === 'hammer') { c.save(); c.translate(tx, ty); c.rotate(Math.atan2(ty - hy, tx - hx)); c.fillStyle = '#5c564f'; c.fillRect(-0.8, -1.7, 2, 3.4); c.fillStyle = '#9e958a'; c.fillRect(-0.8, -1.7, 2, 0.6); c.restore(); }
        else if (tool === 'sickle') { c.strokeStyle = '#d0d4d8'; c.lineWidth = 0.8; c.beginPath(); c.arc(tx + nx * 1.6, ty + ny * 1.6, 2, Math.atan2(ny, nx) + Math.PI * 0.2, Math.atan2(ny, nx) + Math.PI * 1.2); c.stroke(); }
        else { c.fillStyle = '#9e958a'; c.save(); c.translate(tx, ty); c.rotate(Math.atan2(ty - hy, tx - hx)); c.fillRect(0, -1.2, 2.4, 2.4); c.restore(); }
        hand(c, hx, hy, skin[1]);
      } else if (pose === 'smoke') {
        smoothLimb(c, [0.4, shY], [2.6, shY + 2.4], [4.6, headY + 3.6], 1.6, shirt);
        hand(c, 4.8, headY + 3.4, skin[0]);
      } else if (pose === 'tame') {
        smoothLimb(c, [0.4, shY], [3, shY + 1.4], [5.6, shY + 2.4], 1.6, shirt);
        hand(c, 5.9, shY + 2.4, skin[0]);
      } else if (carry && !courier) {
        c.save(); c.translate(-0.6, shY - 3.2); drawLoad(c, carry); c.restore();
        smoothLimb(c, [0.4, shY], [2.4, shY + 0.4], [2.2, shY - 2.4], 1.6, shirt); hand(c, 2.2, shY - 2.8, skin[0]);
      } else {
        const ex = 0.4 + Math.sin(armA) * 2.8, ey = shY + Math.cos(armA) * 2.8;
        const fx = ex + (courier ? 0.5 : 1), fy = ey + 2.6;
        smoothLimb(c, [0.4, shY], [ex, ey], [fx, fy], 1.7, shirt);
        hand(c, fx, fy + 0.3, skin[0]);
      }
    });
  } else {
    // ---------- лицом / спиной ----------
    const front = view === 'S';
    const lift = pose === 'walk' ? [Math.max(0, sw) * (limp ? 0.6 : 1.2), Math.max(0, -sw) * 1.2] : [0, 0];
    const dip = lean * 2.4;
    c.save(); c.translate(0, dip);
    if (carry && courier && front) { c.save(); c.translate(0, headY - 3.6); drawLoad(c, carry); c.restore(); }
    if (courier && front) drawFrame(c, 'S', 0, shY + 3);
    c.restore();
    for (const [k, side] of [[0, -1], [1, 1]]) {
      const x = side * 1.5, ay = -0.2 - lift[k];
      const kx = duck ? side * 2.6 : x * 1.04, ky = (hipY + ay) / 2;
      if (!O.robe) smoothLimb(c, [x, hipY + dip], [kx, ky], [x * 1.05, ay - 0.9], 2.4, side > 0 === front ? shade(pants, -0.25) : pants);
      if (injury === 'leg' && k === 1 && !O.robe) bandage(c, x * 1.05, ky + 0.6, x * 1.05, ay - 1.6);
      boot(c, x * 1.05, ay + 0.2, 0, '#2e1e12');
    }
    c.save(); c.translate(0, dip);
    const armSw = pose === 'walk' ? sw * 0.7 : 0;
    const arm = (side) => {
      const sx = side * 3.3, col = (side > 0) === front ? shade(shirt, -0.25) : shirt;
      const sk = skin[(side > 0) === front ? 1 : 0];
      if (injury === 'arm' && side > 0) {
        smoothLimb(c, [sx, shY + 0.4], [side * 3.4, shY + 3], [side * 0.6, shY + 3.4], 1.5, col);
        if (front) poly(c, [[-2.6, shY + 0.6], [3.4, shY + 2.4], [0, shY + 5]], '#f4f0e6', 'rgba(120,110,100,0.6)', 0.3);
        return;
      }
      if (carry && !courier) {
        smoothLimb(c, [sx, shY + 0.4], [side * 4.2, shY - 0.6], [side * 2.4, shY - 3.4], 1.6, col);
        hand(c, side * 2.4, shY - 3.8, sk);
        return;
      }
      const hy = hipY - 0.6 + (side > 0 ? armSw : -armSw) * (front ? 1 : -1);
      smoothLimb(c, [sx, shY + 0.4], [side * 4.2, (shY + hy) / 2], [side * 3.8, hy], 1.65, col);
      hand(c, side * 3.8, hy + 0.5, sk);
    };
    if (!front) { arm(-1); arm(1); }
    // туловище с животиком
    c.fillStyle = lingrad(c, -3.8, 0, 3.8, 0, front
      ? [[0, shade(shirt, 0.22)], [0.55, shirt], [1, shade(shirt, -0.32)]]
      : [[0, shade(shirt, 0.05)], [1, shade(shirt, -0.42)]]);
    c.beginPath();
    if (O.robe) { c.moveTo(-3.4, shY); c.lineTo(3.4, shY); c.lineTo(4.4, -0.4); c.lineTo(-4.4, -0.4); }
    else { c.moveTo(-3.4, shY); c.lineTo(3.4, shY); c.quadraticCurveTo(4.6, shY + 3.6, 3.4, hipY + 1.8); c.lineTo(-3.4, hipY + 1.8); c.quadraticCurveTo(-4.6, shY + 3.6, -3.4, shY); }
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(20,10,4,0.55)'; c.lineWidth = 0.3; c.stroke();
    if (O.robe) { c.fillStyle = '#c89226'; c.fillRect(-4.2, -1.4, 8.4, 0.5); if (front) c.fillRect(-0.3, shY, 0.6, 12); }
    else {
      if (front) {
        if (O.vest) { c.fillStyle = O.vest; c.fillRect(-3.2, shY + 0.4, 2.2, 5.6); c.fillRect(1, shY + 0.4, 2.2, 5.6); if (O.rivets) { c.fillStyle = '#cec6ba'; for (let k = 0; k < 3; k++) { c.fillRect(-2.4, shY + 1.4 + k * 1.6, 0.4, 0.4); c.fillRect(2, shY + 1.4 + k * 1.6, 0.4, 0.4); } } }
        if (O.apron) { c.fillStyle = lingrad(c, 0, shY + 1.6, 0, -2.4, [[0, O.apron], [1, shade(O.apron, -0.25)]]); c.beginPath(); c.moveTo(-2.4, shY + 2); c.lineTo(2.4, shY + 2); c.lineTo(2.9, -2.4); c.lineTo(-2.9, -2.4); c.closePath(); c.fill(); if (O.blood) { ellipse(c, -0.8, -7, 0.7, 0.9, '#9c2c20'); ellipse(c, 1.2, -4.6, 0.6, 0.7, '#ac3e2a'); } }
        if (courier) { line(c, -2.4, shY + 0.2, -2.2, hipY + 0.8, '#4a2c14', 0.7); line(c, 2.4, shY + 0.2, 2.2, hipY + 0.8, '#4a2c14', 0.7); }
      }
      c.fillStyle = '#2a1a0e'; c.fillRect(-3.5, hipY + 0.2, 7, 0.9);
      if (front) { c.fillStyle = '#c8a050'; rrect(c, -0.7, hipY, 1.4, 1.3, 0.3); c.fill(); }
      c.fillStyle = shade(shirt, -0.15); c.fillRect(-3.4, hipY + 1.1, 6.8, 0.8);
    }
    if (front) { arm(-1); arm(1); }
    drawHead(c, view, 0, headY, L, O, type, false);
    drawCap(c, O, view, 0, headY - 1.4, tipSway, L);
    if (courier && !front) {
      drawFrame(c, 'N', 0, shY + 2.6);
      if (carry) { c.save(); c.translate(0, shY + 0.6); drawLoad(c, carry); c.restore(); }
    }
    if (carry && !courier) { c.save(); c.translate(0, headY - 6); drawLoad(c, carry); c.restore(); }
    c.restore();
  }
  c.restore();
}

const PEOPLE_CACHE = new Map();

function personSprite(u, view, pose, frame) {
  const L = lookOf(u);
  const fkey = pose === 'work' ? `${frame.anim}${frame.f}` : frame;
  const key = `${u.type}|${L.skin}${L.beard}${L.beardLen}${L.braid ? 1 : 0}${L.capTip}|${view}${pose}${fkey}|${u.carry || ''}|${u.injury || ''}`;
  let cv = PEOPLE_CACHE.get(key);
  if (!cv) {
    const [c2, ctx] = mkSprite(PW, PH, PS);
    drawPerson(ctx, u.type, L, view, pose, frame, u.carry, u.injury);
    cv = c2;
    if (PEOPLE_CACHE.size > 3000) PEOPLE_CACHE.clear();
    PEOPLE_CACHE.set(key, cv);
  }
  return cv;
}

// Портрет для интерфейса: голова и колпак крупно.
const PORTRAIT_CACHE = new Map();
function portraitURL(type, look = 3) {
  const key = type + look;
  if (PORTRAIT_CACHE.has(key)) return PORTRAIT_CACHE.get(key);
  const cv = mkCanvas(48, 48);
  const c = cv.getContext('2d');
  c.fillStyle = radgrad(c, 24, 18, 2, 34, [[0, '#5a4430'], [1, '#1a120a']]); c.fillRect(0, 0, 48, 48);
  if (UNIT_TYPES[type] && UNIT_TYPES[type].animal) {
    c.drawImage(creatureSprite('packgoat', 0, null), 0, 0, 48, 48);
  } else {
    const spr = personSprite({ type, look, carry: null }, 'S', 'idle', 0);
    c.imageSmoothingQuality = 'high';
    // голова с колпаком: x 5..21, y 2..24 мировых пикселей
    c.drawImage(spr, 3 * PS, 1 * PS, 20 * PS, 22 * PS, 2, 0, 44, 48);
  }
  const url = cv.toDataURL();
  PORTRAIT_CACHE.set(key, url);
  return url;
}
