'use strict';
// Жители — лесные гномы (пиксель-арт): широкие и коренастые, большие острые уши,
// нос-картошка, пухлые щёки, окладистая светлая борода с мхом, зелёная одежда,
// мшистый колпак цвета профессии с веточками и грибами. Три ракурса
// (S — лицом, N — спиной, E — боком), шаг в 8 кадров, работа, перекур, сон, хромота.
// Спрайт 26×38 мировых пикселей, ступни в точке (13, 35). Рисуется ×6 и
// переводится в пиксель-арт ×2 (полпикселя мира на точку) с тёмной обводкой.

const PS = 6;      // сверхвыборка рисования
const PART = 2;    // пикселей арта на пиксель мира
const PW = 26, PH = 38, PFX = 13, PFY = 35;

const SKINS = [['#f2c8a0', '#d89e78', '#a86a4c'], ['#e4b08a', '#c88864', '#94583c'], ['#c88e66', '#a46a46', '#6e442a']];
const BEARDS = ['#ece6cc', '#e0d8b8', '#cfc8a8', '#d8d0c0', '#b8a888', '#9a7a52', '#c8823a', '#eae0b0'];
const GREENS = ['#4e8a2a', '#5a9a30', '#46802a', '#62a036', '#3e7426'];   // лесная зелень туник

// Колпак — цвет профессии (приглушён под лес), одежда у всех зелёная.
const OUTFIT = {
  serf:       { cap: '#a8682e', pants: '#6a4a2a', frame: true },
  builder:    { cap: '#c09a34', pants: '#5a4028', apron: '#8a6a44', belt: 'hammer' },
  woodcutter: { cap: '#3e7426', pants: '#5a4028', belt: 'axe' },
  carpenter:  { cap: '#a0602c', pants: '#5a4028', apron: '#c8a878' },
  stonemason: { cap: '#7e8078', pants: '#4a4238', apron: '#8a6a44' },
  farmer:     { cap: '#c8b040', pants: '#6a5434', vest: '#7a5432' },
  miller:     { cap: '#e4e0d0', pants: '#8a7a5a', dusty: true },
  baker:      { cap: 'baker', pants: '#7a6a50', apron: '#f4f0e6' },
  miner:      { cap: '#4a4a62', pants: '#3e3630', candle: true },
  smelter:    { cap: '#a8401e', pants: '#4a3426', apron: '#3a2414' },
  breeder:    { cap: '#6a8a32', pants: '#5a4028' },
  butcher:    { cap: '#8c241a', pants: '#4a3a30', apron: '#ece4d0', blood: true },
  tanner:     { cap: '#7a5030', pants: '#4a3420', apron: '#5a3a1e' },
  armorer:    { cap: '#4a5464', pants: '#3a3632', vest: '#5a5a62', rivets: true },
  enchanter:  { cap: 'wizard', pants: '#2a3a20', robe: true },
  hopgrower:  { cap: '#7aa83e', pants: '#5a4028' },
  brewer:     { cap: '#b8862c', pants: '#4a3420', apron: '#a87848' },
  herder:     { cap: '#8aa462', pants: '#5a4028', staff: true },
  stableman:  { cap: '#6e4630', pants: '#4a3420' },
  carter:     { cap: '#56586e', pants: '#4a3a24' },
};

const ANIM_TOOL = { chop: 'axe', mine: 'pick', build: 'hammer', reap: 'sickle', dig: 'spade' };

function lookOf(u) {
  const l = u.look;
  return {
    skin: l % 3,
    beard: u.type === 'enchanter' ? 0 : (l >> 2) % BEARDS.length,
    beardLen: u.type === 'enchanter' ? 2 : 1 + ((l >> 5) % 2),   // 1 до груди, 2 до ремня
    braid: (l >> 7) % 4 === 0,
    capTip: ((l >> 9) & 1) ? 1 : -1,                             // в какую сторону свисает кончик
    green: GREENS[(l >> 11) % GREENS.length],
    deco: (l >> 13) % 4,                                         // 0 веточка, 1 листья, 2 грибок, 3 только мох
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

// Крупный гномий кулак
function hand(c, x, y, col) {
  c.fillStyle = col;
  c.beginPath(); c.ellipse(x, y, 1.15, 1.2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,240,220,0.35)'; c.beginPath(); c.ellipse(x - 0.35, y - 0.4, 0.45, 0.35, 0, 0, Math.PI * 2); c.fill();
}

// Гномий сапог с чуть загнутым носком
function boot(c, x, y, dir, col = '#3a2616') {
  c.fillStyle = col;
  if (dir === 0) { rrect(c, x - 1.8, y - 2, 3.6, 2.3, 0.9); c.fill(); c.fillStyle = shade(col, 0.25); c.fillRect(x - 1.6, y - 2.2, 3.2, 0.6); }
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

// ---------- Лесные мотивы ----------

const MOSS = ['#5a8a2a', '#6e9e34', '#88b444', '#a4c85a', '#3e6a22'];

// Мох крапинками внутри текущего контура (вызывать после clip)
function mossSpeckle(c, x0, y0, w, h, density, r) {
  for (let k = 0; k < w * h * density; k++) {
    const x = x0 + r() * w, y = y0 + r() * h;
    c.fillStyle = MOSS[(r() * MOSS.length) | 0];
    c.globalAlpha = 0.55 + r() * 0.45;
    c.fillRect(x, y, 0.5 + r() * 0.6, 0.5 + r() * 0.5);
  }
  c.globalAlpha = 1;
}

function twig(c, x, y, dir) {
  c.lineCap = 'round';
  line(c, x, y, x + dir * 3.2, y - 3.4, '#5a3a1e', 0.55);
  line(c, x + dir * 1.8, y - 1.9, x + dir * 3.8, y - 1.6, '#5a3a1e', 0.4);
  line(c, x + dir * 3.2, y - 3.4, x + dir * 3.4, y - 4.8, '#5a3a1e', 0.35);
  c.lineCap = 'butt';
  for (const [lx, ly] of [[3.9, -1.5], [3.5, -5], [2.4, -3]]) {
    c.fillStyle = '#6aa036'; c.beginPath(); c.ellipse(x + dir * lx, y + ly, 0.8, 0.45, dir * 0.6, 0, Math.PI * 2); c.fill();
  }
}

function oakLeaves(c, x, y, dir) {
  for (const [lx, ly, a, col] of [[0, 0, 0.5, '#7aa83a'], [1.2 * dir, -0.8, -0.3, '#c8a040'], [-0.6 * dir, -1.2, 1.1, '#5a8a2a']]) {
    c.save(); c.translate(x + lx, y + ly); c.rotate(a * dir);
    c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 1.6, 0.8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = shade(col, -0.35); c.lineWidth = 0.25; c.beginPath(); c.moveTo(-1.4, 0); c.lineTo(1.4, 0); c.stroke();
    c.restore();
  }
}

function mushroom(c, x, y) {
  c.fillStyle = '#f0e8d8'; c.fillRect(x - 0.4, y - 1.4, 0.8, 1.6);
  c.fillStyle = '#c8301e'; c.beginPath(); c.ellipse(x, y - 1.5, 1.5, 1.1, 0, Math.PI, 0); c.fill();
  c.fillStyle = '#ffffff'; c.fillRect(x - 0.7, y - 2.1, 0.4, 0.4); c.fillRect(x + 0.4, y - 2.3, 0.35, 0.35);
}

// ---------- Колпак ----------
// Огромный мшистый колпак: толстый подвёрнутый край на бровях, длинный кончик
// загибается в сторону и свисает вниз.

function capShape(c, hx, b, s, tall) {
  c.beginPath();
  c.moveTo(hx - 4.3 * s, b);
  c.quadraticCurveTo(hx - 4.4 * s, b - tall * 0.62, hx - 0.8 * s, b - tall * 0.88);
  c.quadraticCurveTo(hx + 2.4 * s, b - tall * 1.12, hx + 5.8 * s, b - tall * 0.86);
  c.quadraticCurveTo(hx + 7.6 * s, b - tall * 0.72, hx + 7.8 * s, b - tall * 0.42);
  c.quadraticCurveTo(hx + 6.4 * s, b - tall * 0.66, hx + 3.8 * s, b - tall * 0.7);
  c.quadraticCurveTo(hx + 4.6 * s, b - tall * 0.34, hx + 4.3 * s, b);
  c.closePath();
}

function drawCap(c, O, view, hx, hy, tipSway, L, r) {
  const e = view === 'E';
  const b = hy - 2.7;                         // низ конуса над ободком
  if (O.cap === 'baker') {
    // поварской колпак, переходящий в гномий кончик
    const s = e ? -1 : L.capTip;
    c.fillStyle = lingrad(c, hx - 4, 0, hx + 4, 0, [[0, '#ffffff'], [1, '#c8c4bc']]);
    c.beginPath(); c.moveTo(hx - 1.8, b - 6); c.quadraticCurveTo(hx - 0.4 * s, b - 12, hx + 4.6 * s + tipSway, b - 11); c.quadraticCurveTo(hx + 5.4 * s, b - 9.4, hx + 5.6 * s, b - 8);
    c.quadraticCurveTo(hx + 3 * s, b - 9.6, hx + 2, b - 6); c.closePath(); c.fill();
    for (const [dx, dy, rr] of [[-3, -3.6, 2.4], [0, -4.8, 2.8], [3, -3.6, 2.4], [-1.6, -2, 2.6], [1.6, -2, 2.6]]) ellipse(c, hx + dx, b + dy, rr, rr * 0.9, '#f6f4ee');
    for (const [dx, dy] of [[-3, -3.6], [0, -4.8], [3, -3.6]]) ellipse(c, hx + dx - 0.6, b + dy - 0.6, 0.9, 0.7, '#ffffff');
    c.fillStyle = '#ddd8ce'; rrect(c, hx - 4.6, b - 0.6, 9.2, 2.6, 1.2); c.fill();
    ellipse(c, hx + 5.6 * s, b - 7.6, 0.9, 0.9, '#ffffff');
    return;
  }
  const wizard = O.cap === 'wizard';
  const col = wizard ? '#4c3080' : O.cap;
  const tall = wizard ? 16 : 13;
  const s = e ? -1 : L.capTip;               // боком кончик свисает назад
  if (wizard) ellipse(c, hx, b + 0.6, 5.6, 1.6, shade(col, -0.35));
  // конус
  c.save();
  capShape(c, hx + tipSway * 0.3, b, s, tall);
  c.fillStyle = lingrad(c, hx - 4.5, 0, hx + 5, 0, [[0, shade(col, 0.25)], [0.5, col], [1, shade(col, -0.4)]]);
  c.fill();
  c.clip();
  if (!wizard) mossSpeckle(c, hx - 5, b - tall * 1.1, 13, tall * 1.1, 0.55, r);
  // складки
  c.strokeStyle = shade(col, -0.35); c.lineWidth = 0.35;
  c.beginPath(); c.moveTo(hx - 1.4 * s, b); c.quadraticCurveTo(hx - 1 * s, b - tall * 0.5, hx + 0.6 * s, b - tall * 0.8); c.stroke();
  c.beginPath(); c.moveTo(hx + 2 * s, b); c.quadraticCurveTo(hx + 2.4 * s, b - tall * 0.3, hx + 3.2 * s, b - tall * 0.62); c.stroke();
  c.restore();
  // толстый подвёрнутый край, весь во мху
  c.save();
  rrect(c, hx - 4.9, b - 1.4, 9.8, 3, 1.5);
  c.fillStyle = lingrad(c, 0, b - 1.4, 0, b + 1.6, [[0, shade(col, 0.15)], [1, shade(col, -0.35)]]);
  c.fill();
  c.clip();
  if (!wizard) mossSpeckle(c, hx - 5, b - 1.6, 10, 3.4, 1.4, r);
  c.restore();
  if (wizard) {
    c.fillStyle = '#f6d458'; c.fillRect(hx - 1, b - 6, 0.7, 0.7); c.fillRect(hx + 1.2, b - 10, 0.6, 0.6); c.fillRect(hx - 0.2, b - 3, 0.5, 0.5);
    c.fillStyle = '#c89226'; c.fillRect(hx - 4.6, b - 0.2, 9.2, 0.6);
  }
  // лесные украшения
  if (!wizard && view !== 'N') {
    if (L.deco === 0) twig(c, hx + 3.4 * (e ? -1 : 1), b - 0.6, e ? -1 : 1);
    else if (L.deco === 1) oakLeaves(c, hx - 3.6 * (e ? -1 : 1), b - 0.4, e ? 1 : -1);
    else if (L.deco === 2) mushroom(c, hx - 3 * (e ? -1 : 1), b - 0.6);
  }
  if (O.candle && view !== 'N') {
    const cx = e ? hx + 2.6 : hx;
    c.fillStyle = '#b08a3a'; c.fillRect(cx - 0.9, b - 1, 1.8, 0.9);
    c.fillStyle = '#efe6d0'; c.fillRect(cx - 0.55, b - 3.6, 1.1, 2.6);
    ellipse(c, cx, b - 4.2, 0.55, 0.85, '#ffd060');
  }
  if (O.dusty) { c.fillStyle = 'rgba(255,255,255,0.8)'; for (let k = 0; k < 5; k++) c.fillRect(hx - 2 + k * 1.1, b - 3 - k * 1.3, 0.45, 0.45); }
}

// ---------- Голова ----------

function drawEar(c, x, y, dir, sk) {
  poly(c, [[x, y - 1], [x + dir * 3.6, y - 2.6], [x + dir * 0.4, y + 1.6]], sk[1], shade(sk[2], -0.2), 0.3);
  poly(c, [[x + dir * 0.4, y - 0.6], [x + dir * 2.6, y - 1.8], [x + dir * 0.6, y + 0.9]], sk[2]);
}

function drawBeard(c, view, hx, hy, L, type, bottom, r) {
  const bc = type === 'enchanter' ? '#f0ece4' : BEARDS[L.beard];
  c.save();
  c.beginPath();
  if (view === 'S') {
    // борода начинается ниже щёк и носа
    c.moveTo(hx - 3.8, hy + 1);
    c.quadraticCurveTo(hx - 4.9, (hy + bottom) / 2 + 1, hx - 1.6, bottom - 0.4);
    c.quadraticCurveTo(hx, bottom + 0.8, hx + 1.6, bottom - 0.4);
    c.quadraticCurveTo(hx + 4.9, (hy + bottom) / 2 + 1, hx + 3.8, hy + 1);
    c.quadraticCurveTo(hx, hy + 3.2, hx - 3.8, hy + 1);
  } else {
    c.moveTo(hx - 0.6, hy + 1.4);
    c.quadraticCurveTo(hx - 0.8, (hy + bottom) / 2, hx + 1, bottom);
    c.quadraticCurveTo(hx + 4.2, bottom - 1.6, hx + 4, hy + 2.2);
    c.lineTo(hx + 1.6, hy + 1.6);
  }
  c.closePath();
  c.fillStyle = lingrad(c, hx - 4, 0, hx + 4, 0, [[0, shade(bc, 0.18)], [0.5, bc], [1, shade(bc, -0.25)]]);
  c.fill();
  c.clip();
  // пряди
  c.strokeStyle = shade(bc, -0.28); c.lineWidth = 0.32;
  for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(hx + k * 1.1, hy + 1.6); c.quadraticCurveTo(hx + k * 1.4, (hy + bottom) / 2, hx + k * 0.8, bottom); c.stroke(); }
  // мох в бороде у краёв и внизу
  for (let k = 0; k < 26; k++) {
    const t = r(), side = r() < 0.5 ? -1 : 1;
    const x = view === 'S' ? hx + side * (2.4 + r() * 2.2) : hx + r() * 4, y = hy + 1 + t * (bottom - hy);
    c.fillStyle = MOSS[(r() * 4) | 0]; c.globalAlpha = 0.45 + r() * 0.4;
    c.fillRect(x, y, 0.6, 0.5);
  }
  c.globalAlpha = 1;
  c.restore();
  if (L.braid && view === 'S') for (let k = 0; k < 3; k++) ellipse(c, hx, bottom + 0.8 + k * 1.1, 0.8, 0.65, shade(bc, -0.08 * k));
  return bc;
}

function drawHead(c, view, hx, hy, L, O, type, pipe, bottom, r) {
  const sk = SKINS[L.skin];
  const R = 3.8;
  if (view === 'S') {
    drawEar(c, hx - 3.4, hy + 0.2, -1, sk); drawEar(c, hx + 3.4, hy + 0.2, 1, sk);
    c.fillStyle = radgrad(c, hx - 1, hy - 1, 0.4, R * 1.5, [[0, sk[0]], [0.7, sk[1]], [1, sk[2]]]);
    c.beginPath(); c.ellipse(hx, hy, R, R * 1.02, 0, 0, Math.PI * 2); c.fill();
    const bc = drawBeard(c, 'S', hx, hy, L, type, bottom, r);
    // пухлые румяные щёки
    ellipse(c, hx - 2.4, hy + 1.1, 1.5, 1.2, sk[0]); ellipse(c, hx + 2.4, hy + 1.1, 1.5, 1.2, sk[0]);
    ellipse(c, hx - 2.4, hy + 1.3, 1.1, 0.8, 'rgba(225,100,80,0.55)'); ellipse(c, hx + 2.4, hy + 1.3, 1.1, 0.8, 'rgba(225,100,80,0.55)');
    // прищуренные глаза под густыми бровями
    c.fillStyle = '#ffffff'; rrect(c, hx - 2.3, hy - 0.2, 1.6, 0.9, 0.35); c.fill(); rrect(c, hx + 0.7, hy - 0.2, 1.6, 0.9, 0.35); c.fill();
    c.fillStyle = '#2a1408'; c.fillRect(hx - 1.7, hy - 0.2, 0.8, 0.9); c.fillRect(hx + 1.1, hy - 0.2, 0.8, 0.9);
    c.fillStyle = shade(bc, -0.08); rrect(c, hx - 2.9, hy - 1.1, 2.6, 1, 0.45); c.fill(); rrect(c, hx + 0.3, hy - 1.1, 2.6, 1, 0.45); c.fill();
    // нос-картошка
    ellipse(c, hx, hy + 1.3, 1.6, 1.4, sk[1]); ellipse(c, hx, hy + 1.8, 1.2, 0.8, shade(sk[1], -0.08)); ellipse(c, hx - 0.5, hy + 0.9, 0.55, 0.45, 'rgba(255,240,220,0.7)');
    // пышные усы
    ellipse(c, hx - 1.8, hy + 2.9, 2, 1, shade(bc, 0.12)); ellipse(c, hx + 1.8, hy + 2.9, 2, 1, shade(bc, 0.05));
  } else if (view === 'E') {
    drawEar(c, hx - 2.6, hy + 0.2, -1, sk);
    c.fillStyle = radgrad(c, hx, hy - 1, 0.4, R * 1.5, [[0, sk[0]], [0.7, sk[1]], [1, sk[2]]]);
    c.beginPath(); c.ellipse(hx, hy, R * 0.92, R, 0, 0, Math.PI * 2); c.fill();
    const bc = drawBeard(c, 'E', hx, hy, L, type, bottom, r);
    ellipse(c, hx + 1.9, hy + 1.1, 1.3, 1.1, sk[0]); ellipse(c, hx + 1.9, hy + 1.3, 1, 0.7, 'rgba(225,100,80,0.55)');
    c.fillStyle = '#ffffff'; rrect(c, hx + 1.2, hy - 0.2, 1.4, 0.9, 0.35); c.fill();
    c.fillStyle = '#2a1408'; c.fillRect(hx + 1.8, hy - 0.2, 0.8, 0.9);
    c.fillStyle = shade(bc, -0.08); rrect(c, hx + 0.8, hy - 1.1, 2.6, 1, 0.45); c.fill();
    ellipse(c, hx + 3.8, hy + 1.3, 1.55, 1.4, sk[1]); ellipse(c, hx + 3.4, hy + 0.9, 0.5, 0.4, 'rgba(255,240,220,0.7)');
    ellipse(c, hx + 2.9, hy + 2.9, 1.8, 0.9, shade(bc, 0.1));
    if (pipe) {
      line(c, hx + 3, hy + 2.4, hx + 6, hy + 3.2, '#4a2c14', 0.6);
      c.fillStyle = '#6a3c1c'; rrect(c, hx + 5.4, hy + 1.4, 1.7, 2.3, 0.4); c.fill();
      ellipse(c, hx + 6.25, hy + 1.5, 0.75, 0.3, 'rgba(255,140,40,0.9)');
    }
  } else {
    drawEar(c, hx - 3.4, hy + 0.2, -1, sk); drawEar(c, hx + 3.4, hy + 0.2, 1, sk);
    const bc = type === 'enchanter' ? '#f0ece4' : BEARDS[L.beard];
    c.fillStyle = bc; c.beginPath(); c.ellipse(hx, hy + 0.4, R, R * 0.95, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = shade(bc, -0.25); c.lineWidth = 0.3;
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(hx + k * 1.2, hy - 1); c.lineTo(hx + k * 1.3, hy + 3.6); c.stroke(); }
    ellipse(c, hx - 3.6, hy + 3, 1, 2, bc); ellipse(c, hx + 3.6, hy + 3, 1, 2, bc);
  }
}

// ---------- Жесты ----------
// Локоть и кисть для жеста: E — сбоку (лицом вправо, плечо в x≈0.4), S/N — рука side=±1.
function gestPts(g, f, side, shY, headY, view) {
  if (view === 'E') switch (g) {
    case 'wave':    return [[2.6, shY - 2.2], [3.4 + f * 1.2, headY - 3.4]];
    case 'fist':    return [[3.8, shY - 0.4], [4.6, headY - 1.6 - f * 1.4]];
    case 'scratch': return [[3.8, shY - 1.4], [2, headY - 3.6 + f * 0.5]];
    case 'stretch': return [[1.6, shY - 3.6], [1, headY - 7 - f * 0.6]];
    case 'yawn':    return [[3.2, shY + 1.6], [4.4, headY + 3.4]];
    default:        return [[3.4, shY], [6.4, shY - 0.6 - f * 0.3]];     // point
  }
  switch (g) {
    case 'wave':    return [[side * 6.2, shY - 1.6], [side * (6.4 + f * 1.2), headY - 3.4]];
    case 'fist':    return [[side * 6.4, shY + 0.4], [side * 5.8, headY - 1.6 - f * 1.4]];
    case 'scratch': return [[side * 6.6, shY - 1.4], [side * 4.4, headY - 3.4 + f * 0.5]];
    case 'stretch': return [[side * 5.8, shY - 3.2], [side * 4.2, headY - 7.4 - f * 0.6]];
    case 'yawn':    return [[side * 5, shY + 1.6], [side * 1.2, headY + 3.4]];
    default:        return [[side * 5.8, shY + 0.4], [side * 7.4, shY - 0.6 - f * 0.3]];
  }
}

// ---------- Фигура ----------
// pose: idle | walk | work | duck | smoke | tame; frame: 0..7 для шага, {anim, f} для работы
// opt.gait: '' — вразвалочку, 'drunk' — шатается, 'tired' — голодный плетётся;
// opt.gest: wave | fist | scratch | stretch | yawn | point, opt.gf — кадр жеста 0/1.

function drawPerson(c, type, L, view, pose, frame, carry, injury, r, opt = {}) {
  const O = OUTFIT[type] || OUTFIT.serf;
  const shirt = O.robe ? '#2e5a26' : L.green, pants = O.pants;
  const gait = opt.gait || '', gest = carry ? '' : (opt.gest || ''), gf = opt.gf || 0;
  const ph = pose === 'walk' ? frame / 8 * Math.PI * 2 : 0;
  const sw = Math.sin(ph);
  const limp = injury === 'leg' && pose === 'walk';
  const bob = pose === 'walk' ? -Math.abs(Math.cos(ph)) * (limp ? 1.2 : gait === 'tired' ? 0.3 : 0.7) + 0.3 : 0;
  const courier = !!O.frame;
  const duck = pose === 'duck' || pose === 'tame';
  const crouch = duck ? 1.8 : 0;
  let lean = 0;
  if (pose === 'walk') lean = carry ? 0.16 : 0.05;
  if (pose === 'walk' && gait === 'tired') lean += 0.16;
  if (pose === 'walk' && gait === 'drunk') lean += Math.cos(ph) * 0.1;
  if (limp) lean += sw > 0 ? 0.12 : -0.02;
  if (pose === 'work' && (frame.anim === 'reap' || frame.anim === 'dig')) lean = 0.28;
  if (duck) lean = 0.42;
  if (gest === 'stretch') lean = -0.08;
  const tipSway = pose === 'walk' ? Math.sin(ph + 1) * (gait === 'drunk' ? 1.6 : 1) : gest === 'stretch' ? -0.6 : 0;
  // походка вразвалочку: коротконогий гном перекатывается с ноги на ногу
  let roll = 0, sway = 0;
  if (pose === 'walk') {
    const amp = gait === 'drunk' ? 0.3 : gait === 'tired' ? 0.07 : 0.15;
    roll = sw * amp * (view === 'E' ? 0.35 : 1);
    sway = sw * (view === 'E' ? 0.25 : 0.8);
    if (gait === 'drunk') roll += Math.cos(ph) * 0.08;
  }
  c.save();
  c.translate(PFX + sway, PFY + bob);
  c.rotate(roll);
  const hipY = -6.2 + crouch, shY = -12 + crouch, headY = -16.6 + crouch;
  const beardBottom = L.beardLen === 2 ? hipY + 0.2 : shY + 3.4;
  const upper = fn => { c.save(); c.translate(0, hipY); c.rotate(lean); c.translate(0, -hipY); fn(); c.restore(); };
  const skin = SKINS[L.skin];

  // зелёная туника: широкая, с животиком и «лиственным» подолом
  const tunicFront = () => {
    c.save();
    c.beginPath();
    if (O.robe) { c.moveTo(-4.2, shY); c.lineTo(4.2, shY); c.lineTo(5.2, -0.4); c.lineTo(-5.2, -0.4); }
    else {
      c.moveTo(-4.4, shY + 0.4);
      c.quadraticCurveTo(-4.2, shY - 0.6, -2.6, shY - 0.6); c.lineTo(2.6, shY - 0.6);
      c.quadraticCurveTo(4.2, shY - 0.6, 4.4, shY + 0.4);
      c.quadraticCurveTo(5.8, shY + 4, 4.8, hipY + 2.4);
      for (let k = 0; k <= 6; k++) c.lineTo(4.8 - k * 1.6, hipY + 2.4 + (k % 2 ? 0.9 : 0));
      c.quadraticCurveTo(-5.8, shY + 4, -4.4, shY + 0.4);
    }
    c.closePath();
    c.fillStyle = lingrad(c, -5, 0, 5, 0, [[0, shade(shirt, 0.25)], [0.55, shirt], [1, shade(shirt, -0.38)]]);
    c.fill();
    c.clip();
    mossSpeckle(c, -5, shY - 1, 10, 3.2, 0.9, r);           // мох на плечах
    mossSpeckle(c, -5, shY, 10, hipY - shY + 3, 0.12, r);
    c.restore();
  };

  if (view === 'E') {
    // ---------- боком, лицом вправо ----------
    const legs = [{ th: -sw * 0.5, far: true }, { th: sw * 0.5, far: false }];
    const legPts = l => {
      if (duck) return l.far ? [2.2, hipY + 2.8, 0.6, -0.2] : [3, hipY + 2.6, 1.4, -0.2];
      const stiff = limp && !l.far;
      const bend = pose === 'walk' && !stiff ? Math.max(0, Math.sin(ph + (l.far ? Math.PI : 0) + Math.PI / 2)) * 0.7 : 0.05;
      const th = stiff ? l.th * 0.5 : l.th;
      const kx = Math.sin(th) * 3.2 + 0.3, ky = hipY + Math.cos(th) * 3.2;
      const ax = kx + Math.sin(th - bend) * 3.1 - 0.3, ay = ky + Math.cos(th - bend) * 3.1;
      return [kx, ky, ax, Math.min(ay, -0.2)];
    };
    const drawLeg = l => {
      const [kx, ky, ax, ay] = legPts(l);
      const col = l.far ? shade(pants, -0.3) : pants;
      if (!O.robe) smoothLimb(c, [0, hipY], [kx, ky], [ax, ay - 0.8], 2.8, col);
      if (injury === 'leg' && !l.far && !O.robe) bandage(c, kx, ky + 0.4, ax, ay - 1.4);
      boot(c, ax, ay + 0.2, 1, l.far ? '#2e1c10' : '#5a3a20');
    };
    const tool = pose === 'work' ? (ANIM_TOOL[frame.anim] || 'hammer') : null;
    const swingA = tool === 'sickle' || tool === 'spade' ? [1.2, 1.7, 2.2, 2.6] : [-0.7, 0.2, 1.3, 2.1];
    const ang = tool ? swingA[frame.f] : 0;
    const armA = pose === 'walk' ? -sw * 0.55 : duck ? -0.5 : 0;
    const sling = injury === 'arm';
    if (!tool && !carry && pose !== 'smoke') upper(() => {
      const ex = Math.sin(-armA) * 2.8, ey = shY + Math.cos(-armA) * 2.8;
      smoothLimb(c, [-0.4, shY + 0.4], [ex, ey], [ex + 0.8, ey + 2.6], 2.2, shade(shirt, -0.35));
      hand(c, ex + 0.8, ey + 3, skin[2]);
    });
    drawLeg(legs[0]);
    upper(() => {
      if (courier) drawFrame(c, 'E', -3, shY + 3);
      if (carry && courier) { c.save(); c.translate(-5.2, shY); c.rotate(-Math.PI / 2 * (carry === 'trunk' || carry === 'timber' || carry === 'staff' ? 1 : 0)); drawLoad(c, carry); c.restore(); }
      if (O.staff) line(c, -2.8, shY + 6, -1.2, shY - 8, '#6a4424', 0.8);
    });
    drawLeg(legs[1]);
    upper(() => {
      // туловище боком: спина и большой живот
      c.save();
      c.beginPath();
      c.moveTo(-2.8, shY - 0.4); c.lineTo(2, shY - 0.4);
      c.quadraticCurveTo(5.4, shY + 3.6, 3.6, hipY + 2.2);
      for (let k = 0; k <= 4; k++) c.lineTo(3.6 - k * 1.7, hipY + 2.2 + (k % 2 ? 0.8 : 0));
      c.quadraticCurveTo(-3.8, shY + 3, -2.8, shY - 0.4);
      c.closePath();
      c.fillStyle = lingrad(c, -3.6, 0, 4.6, 0, [[0, shade(shirt, 0.22)], [0.55, shirt], [1, shade(shirt, -0.35)]]);
      c.fill(); c.clip();
      mossSpeckle(c, -4, shY - 1, 9, 3, 0.9, r);
      c.restore();
      if (O.vest) { c.fillStyle = O.vest; c.beginPath(); c.moveTo(-2, shY); c.lineTo(1.8, shY); c.quadraticCurveTo(4.4, shY + 3, 3, hipY + 0.6); c.lineTo(-2.4, hipY + 0.6); c.fill(); }
      if (O.apron) { c.fillStyle = lingrad(c, 0, shY + 1, 0, -2.4, [[0, O.apron], [1, shade(O.apron, -0.25)]]); c.beginPath(); c.moveTo(1.2, shY + 2); c.lineTo(3.8, shY + 2.4); c.quadraticCurveTo(5, -5, 3.8 + sw * 0.4, -2.4); c.lineTo(1.4, -2.4); c.closePath(); c.fill(); if (O.blood) { ellipse(c, 3, -7.4, 0.6, 0.8, '#9c2c20'); ellipse(c, 3.3, -4.8, 0.5, 0.6, '#ac3e2a'); } }
      if (!O.robe) {
        c.fillStyle = '#5a3a1e'; c.fillRect(-3, hipY - 0.3, 6.8, 1.5);
        c.fillStyle = '#c8a050'; c.fillRect(2.4, hipY - 0.3, 1.1, 1.5);
        c.fillStyle = '#7a5030'; rrect(c, -3.2, hipY + 0.8, 1.8, 2, 0.5); c.fill();
        if (O.belt === 'hammer') { line(c, -1.4, hipY + 0.8, -1.8, hipY + 3.6, '#6a4424', 0.6); c.fillStyle = '#6a6a70'; c.fillRect(-2.4, hipY + 0.4, 1.8, 0.9); }
        if (O.belt === 'axe') { line(c, -1.6, hipY + 0.6, -2.4, hipY + 4, '#6a4424', 0.6); poly(c, [[-2.4, hipY + 3.6], [-3.8, hipY + 3.2], [-3.6, hipY + 4.8]], '#b8bcc0'); }
      }
      if (courier) line(c, -2, shY + 0.2, 2.4, hipY, '#4a2c14', 0.6);
      drawHead(c, 'E', 0.6, headY, L, O, type, pose === 'smoke', beardBottom, r);
      drawCap(c, O, 'E', 0.6, headY, tipSway, L, r);
      if (sling) {
        poly(c, [[-0.4, shY + 0.6], [3.4, shY + 3.2], [-0.8, shY + 4.4]], '#f4f0e6', 'rgba(120,110,100,0.6)', 0.3);
        smoothLimb(c, [0.4, shY + 0.4], [0.6, shY + 3], [2.8, shY + 3], 2, shirt);
        hand(c, 3, shY + 3, skin[0]);
      } else if (tool) {
        const hx = 0.4 + Math.sin(ang) * 3.8, hy = shY - Math.cos(ang) * 3.8;
        const tx = hx + Math.sin(ang) * 6.5, ty = hy - Math.cos(ang) * 6.5;
        smoothLimb(c, [0.4, shY + 0.4], [(0.4 + hx) / 2 + 0.6, (shY + hy) / 2 + 0.5], [hx, hy], 2.1, shirt);
        line(c, hx - (tx - hx) * 0.25, hy - (ty - hy) * 0.25, tx, ty, '#6e4428', 0.9);
        const nx = -(ty - hy) / 6.5, ny = (tx - hx) / 6.5;
        if (tool === 'axe') poly(c, [[tx, ty], [tx + nx * 2.4, ty + ny * 2.4], [tx + nx * 2.2 - (tx - hx) * 0.22, ty + ny * 2.2 - (ty - hy) * 0.22], [tx - (tx - hx) * 0.15, ty - (ty - hy) * 0.15]], '#b8bcc0', '#3a3a3e', 0.3);
        else if (tool === 'pick') { c.strokeStyle = '#8a8e92'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(tx - nx * 3.2, ty - ny * 3.2); c.quadraticCurveTo(tx + (tx - hx) * 0.08, ty + (ty - hy) * 0.08, tx + nx * 3.2, ty + ny * 3.2); c.stroke(); }
        else if (tool === 'hammer') { c.save(); c.translate(tx, ty); c.rotate(Math.atan2(ty - hy, tx - hx)); c.fillStyle = '#5c564f'; c.fillRect(-0.8, -1.7, 2, 3.4); c.fillStyle = '#9e958a'; c.fillRect(-0.8, -1.7, 2, 0.6); c.restore(); }
        else if (tool === 'sickle') { c.strokeStyle = '#d0d4d8'; c.lineWidth = 0.8; c.beginPath(); c.arc(tx + nx * 1.6, ty + ny * 1.6, 2, Math.atan2(ny, nx) + Math.PI * 0.2, Math.atan2(ny, nx) + Math.PI * 1.2); c.stroke(); }
        else { c.fillStyle = '#9e958a'; c.save(); c.translate(tx, ty); c.rotate(Math.atan2(ty - hy, tx - hx)); c.fillRect(0, -1.2, 2.4, 2.4); c.restore(); }
        hand(c, hx, hy, skin[1]);
      } else if (gest) {
        const [e, h] = gestPts(gest, gf, 1, shY, headY, 'E');
        smoothLimb(c, [0.4, shY + 0.4], e, h, 2.1, shirt);
        hand(c, h[0], h[1], skin[0]);
        if (gest === 'yawn') ellipse(c, 3.6, headY + 3.6, 0.8, 0.6, '#3a1408');
      } else if (pose === 'smoke') {
        smoothLimb(c, [0.4, shY + 0.4], [2.8, shY + 2.4], [4.8, headY + 3.8], 2, shirt);
        hand(c, 5, headY + 3.6, skin[0]);
      } else if (pose === 'tame') {
        smoothLimb(c, [0.4, shY + 0.4], [3, shY + 1.4], [5.8, shY + 2.4], 2, shirt);
        hand(c, 6.1, shY + 2.4, skin[0]);
      } else if (carry && !courier) {
        c.save(); c.translate(-0.6, headY - 6.4); drawLoad(c, carry); c.restore();
        smoothLimb(c, [0.4, shY + 0.4], [2.6, shY - 1], [2.2, headY - 3.4], 1.9, shirt); hand(c, 2.2, headY - 3.8, skin[0]);
      } else {
        const ex = 0.4 + Math.sin(armA) * 2.8, ey = shY + Math.cos(armA) * 2.8;
        const fx = ex + (courier ? 0.5 : 1), fy = ey + 2.6;
        smoothLimb(c, [0.4, shY + 0.4], [ex, ey], [fx, fy], 2.2, shirt);
        hand(c, fx, fy + 0.4, skin[0]);
      }
    });
  } else {
    // ---------- лицом / спиной ----------
    const front = view === 'S';
    const lift = pose === 'walk' ? [Math.max(0, sw) * (limp ? 0.6 : 1.2), Math.max(0, -sw) * 1.2] : [0, 0];
    const dip = lean * 2.4;
    c.save(); c.translate(0, dip);
    if (carry && courier && front) { c.save(); c.translate(0, headY - 4); drawLoad(c, carry); c.restore(); }
    if (courier && front) drawFrame(c, 'S', 0, shY + 3);
    c.restore();
    for (const [k, side] of [[0, -1], [1, 1]]) {
      const x = side * 1.9, ay = -0.2 - lift[k];
      const kx = duck ? side * 3 : x * 1.04, ky = (hipY + ay) / 2;
      if (!O.robe) smoothLimb(c, [x, hipY + dip], [kx, ky], [x * 1.05, ay - 1], 2.9, side > 0 === front ? shade(pants, -0.25) : pants);
      if (injury === 'leg' && k === 1 && !O.robe) bandage(c, x * 1.05, ky + 0.6, x * 1.05, ay - 1.6);
      boot(c, x * 1.05, ay + 0.2, 0, '#5a3a20');
    }
    c.save(); c.translate(0, dip);
    const armSw = pose === 'walk' ? sw * 0.7 : 0;
    const arm = (side) => {
      const sx = side * 4.2, col = (side > 0) === front ? shade(shirt, -0.25) : shirt;
      const sk = skin[(side > 0) === front ? 1 : 0];
      if (injury === 'arm' && side > 0) {
        smoothLimb(c, [sx, shY + 0.6], [side * 4.4, shY + 3], [side * 0.8, shY + 3.6], 2, col);
        if (front) poly(c, [[-3, shY + 0.6], [4, shY + 2.6], [0, shY + 5.4]], '#f4f0e6', 'rgba(120,110,100,0.6)', 0.3);
        return;
      }
      if (gest && (side > 0 || gest === 'stretch')) {
        const [e, h] = gestPts(gest, gf, side, shY, headY, 'S');
        smoothLimb(c, [sx, shY + 0.6], e, h, 2.2, col);
        hand(c, h[0], h[1], sk);
        return;
      }
      if (carry && !courier) {
        smoothLimb(c, [sx, shY + 0.6], [side * 5, shY - 1], [side * 2.6, headY - 3.6], 2, col);
        hand(c, side * 2.6, headY - 4, sk);
        return;
      }
      // руки-кулаки у бёдер, как у гнома с референса
      const hy = hipY - 0.2 + (side > 0 ? armSw : -armSw) * (front ? 1 : -1);
      smoothLimb(c, [sx, shY + 0.6], [side * 5.4, (shY + hy) / 2], [side * 5, hy], 2.3, col);
      hand(c, side * 5.1, hy + 0.5, sk);
    };
    if (!front) { arm(-1); arm(1); }
    tunicFront();
    if (O.robe) { c.fillStyle = '#c89226'; c.fillRect(-5, -1.4, 10, 0.5); if (front) c.fillRect(-0.3, shY, 0.6, 12); }
    else {
      if (front) {
        if (O.vest) { c.fillStyle = O.vest; c.fillRect(-3.8, shY + 0.4, 2.4, 5.4); c.fillRect(1.4, shY + 0.4, 2.4, 5.4); if (O.rivets) { c.fillStyle = '#cec6ba'; for (let k = 0; k < 3; k++) { c.fillRect(-2.8, shY + 1.4 + k * 1.6, 0.4, 0.4); c.fillRect(2.4, shY + 1.4 + k * 1.6, 0.4, 0.4); } } }
        if (O.apron) { c.fillStyle = lingrad(c, 0, shY + 1.6, 0, -1.6, [[0, O.apron], [1, shade(O.apron, -0.25)]]); c.beginPath(); c.moveTo(-2.8, shY + 2); c.lineTo(2.8, shY + 2); c.lineTo(3.4, -1.6); c.lineTo(-3.4, -1.6); c.closePath(); c.fill(); if (O.blood) { ellipse(c, -1, -6.4, 0.7, 0.9, '#9c2c20'); ellipse(c, 1.4, -4, 0.6, 0.7, '#ac3e2a'); } }
        if (courier) { line(c, -2.8, shY, -2.6, hipY, '#4a2c14', 0.8); line(c, 2.8, shY, 2.6, hipY, '#4a2c14', 0.8); }
      }
      // широкий кожаный ремень с пряжкой и сумочкой
      c.fillStyle = '#5a3a1e'; c.fillRect(-4.9, hipY - 0.4, 9.8, 1.6);
      c.fillStyle = 'rgba(255,220,170,0.25)'; c.fillRect(-4.9, hipY - 0.4, 9.8, 0.35);
      if (front) {
        c.fillStyle = '#c8a050'; rrect(c, -1, hipY - 0.6, 2, 2, 0.4); c.fill();
        c.fillStyle = '#5a3a1e'; c.fillRect(-0.4, hipY - 0.1, 0.8, 1);
        c.fillStyle = '#7a5030'; rrect(c, 2.2, hipY + 0.8, 2.2, 2.4, 0.6); c.fill();
        c.fillStyle = '#5a3a1e'; c.fillRect(2.2, hipY + 0.8, 2.2, 0.6);
      }
    }
    if (front) { arm(-1); arm(1); }
    drawHead(c, view, 0, headY, L, O, type, false, beardBottom, r);
    drawCap(c, O, view, 0, headY, tipSway, L, r);
    // поднятая рука жеста — поверх головы и бороды
    if (gest && front) { arm(1); if (gest === 'stretch') arm(-1); }
    if (courier && !front) {
      drawFrame(c, 'N', 0, shY + 2.6);
      if (carry) { c.save(); c.translate(0, shY + 0.6); drawLoad(c, carry); c.restore(); }
    }
    if (carry && !courier) { c.save(); c.translate(0, headY - 6.6); drawLoad(c, carry); c.restore(); }
    c.restore();
  }
  c.restore();
}

const PEOPLE_CACHE = new Map();

function personSprite(u, view, pose, frame, opt = {}) {
  const L = lookOf(u);
  const fkey = pose === 'work' ? `${frame.anim}${frame.f}` : frame;
  const okey = `${opt.gait || ''}${opt.gest ? opt.gest + (opt.gf || 0) : ''}`;
  const key = `${u.type}|${u.look}|${view}${pose}${fkey}|${u.carry || ''}|${u.injury || ''}|${okey}`;
  let cv = PEOPLE_CACHE.get(key);
  if (!cv) {
    const [c2, ctx] = mkSprite(PW, PH, PS);
    // мох и крапинки одинаковые у одного гнома во всех кадрах
    drawPerson(ctx, u.type, L, view, pose, frame, u.carry, u.injury, mulberry32(u.look * 977 + 13), opt);
    cv = toPixelArt(c2, PS / PART, { outline: true, outlineDark: 0.36, alphaCut: 105 });
    if (PEOPLE_CACHE.size > 3000) PEOPLE_CACHE.clear();
    PEOPLE_CACHE.set(key, cv);
  }
  return cv;
}

// Портрет для интерфейса: голова, уши и колпак крупно.
const PORTRAIT_CACHE = new Map();
function portraitURL(type, look = 3) {
  const key = type + look;
  if (PORTRAIT_CACHE.has(key)) return PORTRAIT_CACHE.get(key);
  const cv = mkCanvas(48, 48);
  const c = cv.getContext('2d');
  c.fillStyle = radgrad(c, 24, 18, 2, 34, [[0, '#4a5a30'], [1, '#141a0c']]); c.fillRect(0, 0, 48, 48);
  c.imageSmoothingEnabled = false;
  if (UNIT_TYPES[type] && UNIT_TYPES[type].animal) {
    c.imageSmoothingEnabled = true;
    c.drawImage(creatureSprite('packgoat', 0, null), 0, 0, 48, 48);
  } else {
    const spr = personSprite({ type, look, carry: null }, 'S', 'idle', 0);
    // область головы: x 1..25, y 0..24 мировых пикселей
    c.drawImage(spr, 1 * PART, 0, 24 * PART, 24 * PART, 0, 0, 48, 48);
  }
  const url = cv.toDataURL();
  PORTRAIT_CACHE.set(key, url);
  return url;
}

