'use strict';
// Жители — лесные гномы (пиксель-арт): широкие и коренастые, большие острые уши,
// нос-картошка, пухлые щёки, окладистая светлая борода с мхом, зелёная одежда,
// мшистый колпак цвета профессии с веточками и грибами. Три ракурса
// (S — лицом, N — спиной, E — боком), шаг в 8 кадров, работа, перекур, сон, хромота.
// Спрайт 26×38 мировых пикселей, ступни в точке (13, 35). Рисуется ×6 и
// переводится в пиксель-арт ×2 (полпикселя мира на точку) с тёмной обводкой.

const PS = 6;      // сверхвыборка рисования
const PART = PX_FINE > 1 ? 3 : 2;    // пикселей арта на пиксель мира: ×3 (как у нечисти), на телефонах и слабых — как раньше ×2
const PW = 26, PH = 38, PFX = 13, PFY = 35;

const SKINS = [['#f2c8a0', '#d89e78', '#a86a4c'], ['#e4b08a', '#c88864', '#94583c'], ['#c88e66', '#a46a46', '#6e442a']];
const BEARDS = ['#ece6cc', '#e0d8b8', '#cfc8a8', '#d8d0c0', '#b8a888', '#9a7a52', '#c8823a', '#eae0b0', '#6a5a4a', '#3e3028', '#b04a24', '#d8c8a0'];
const GREENS = ['#4e8a2a', '#5a9a30', '#46802a', '#62a036', '#3e7426'];   // лесная зелень туник

// Колпак — цвет профессии (приглушён под лес), одежда у всех зелёная.
// Колпак и куртка — свои у каждой профессии, чтобы гномов было легко различать.
// Трудяги — в зелёных колпаках разных оттенков (см. SERF_CAPS) и зелёных туниках.
const OUTFIT = {
  serf:       { cap: 'serf', pants: '#6a4a2a', frame: true },
  builder:    { cap: '#e0a822', pants: '#5a4028', apron: '#8a6a44', belt: 'hammer', coat: '#6e1c22' },   // жёлтый колпак, бордовая куртка
  woodcutter: { cap: '#c83a28', pants: '#4a3a2a', belt: 'axe', coat: '#2e5a7e' },          // красный колпак, синяя куртка
  carpenter:  { cap: '#e8782c', pants: '#5a4028', apron: '#c8a878', coat: '#4a6a8a' },     // оранжевый / серо-синяя
  stonemason: { cap: '#9a9aa6', pants: '#4a4238', apron: '#8a6a44', coat: '#8a6e4c' },     // серый / песочная
  farmer:     { cap: '#f0d040', pants: '#6a5434', vest: '#7a5432', coat: '#6e8e3a' },      // соломенно-жёлтый / оливковая
  miller:     { cap: '#f4f0e4', pants: '#8a7a5a', dusty: true, coat: '#b4a280' },          // белый / бежевая
  baker:      { cap: 'baker', pants: '#7a6a50', apron: '#f4f0e6', coat: '#c86a3a' },       // поварской колпак / рыжая
  miner:      { cap: '#2e4a7a', pants: '#3e3630', candle: true, coat: '#5e5448' },         // тёмно-синий / серо-бурая
  smelter:    { cap: '#e04a1e', pants: '#4a3426', apron: '#3a2414', coat: '#5a3a2a' },     // огненный / тёмная
  breeder:    { cap: '#e886a8', pants: '#5a4028', coat: '#7a6a3a' },                       // розовый / охра
  butcher:    { cap: '#8a1a1a', pants: '#4a3a30', apron: '#ece4d0', blood: true, coat: '#5a5a62' },
  tanner:     { cap: '#9a6a34', pants: '#4a3420', apron: '#5a3a1e', coat: '#3e6a5a' },     // кожаный / бирюзовая
  armorer:    { cap: '#3a4a6a', pants: '#3a3632', vest: '#5a5a62', rivets: true, coat: '#7a2a2a' },
  enchanter:  { cap: 'wizard', pants: '#2a3a20', robe: true },
  hopgrower:  { cap: '#8ad040', pants: '#5a4028', coat: '#8a6a2a' },                       // салатовый / горчичная
  brewer:     { cap: '#c8862a', pants: '#4a3420', apron: '#a87848', coat: '#5a3a6a' },     // янтарный / сливовая
  herder:     { cap: '#4aa8d0', pants: '#5a4028', staff: true, coat: '#8a7a5a' },          // небесный / льняная
  stableman:  { cap: '#7a3a9a', pants: '#4a3420', coat: '#6a4a30' },                       // фиолетовый / коричневая
  carter:     { cap: '#3a3a5a', pants: '#4a3a24', coat: '#6a5a4a' },
  waitress:   { cap: 'waitress', pants: '#efe6d6', coat: '#3f7a46', skirt: '#8e3a2c', apron: '#f6f1e4', fem: true },   // гномка-официантка: рыжие косы, зелёный лиф, красная юбка, фартук
  hero:       { cap: '#d4a018', pants: '#3a2a1c', coat: '#8a1c22', belt: 'hammer', apron: '#c8a030' },   // золотой колпак, алая куртка
};
const HAIR = '#c9501c', HAIR_D = '#8e3412', HAIR_L = '#e8742c';   // рыжие волосы официантки
const SERF_CAPS = ['#3e7426', '#4e8a2a', '#5c9a34', '#2e5a22', '#6aa83e', '#46743a'];

const GIRL_LOOK = { skin: 0, beard: 0, beardLen: 0, beardStyle: 0, must: 0, nose: 0, brow: 0, earring: false, freckles: false, braid: false, capTip: 1, green: '#3f7a46', deco: 5, serfCap: '#fff', capStyle: 0 };
const ANIM_TOOL = { chop: 'axe', mine: 'pick', build: 'hammer', reap: 'sickle', dig: 'spade', hoppick: 'hook', toss: 'toss', pat: 'pat', douse: 'bucket' };   // toss — бросок без инструмента (снежок, бита: 9 кадров), pat — хлопает песок (8)

// Внешность гнома целиком выводится из числа look: один и тот же гном всегда выглядит одинаково.
// Чтобы признаки не зависели друг от друга (как было с битовыми сдвигами), берём их из
// детерминированного генератора.
// u.sx — 'f' у гномок (folk.js), тип kid — гномёнок: без бороды, вязаная шапочка с помпоном.
function lookOf(u) {
  const l = u.look;
  if (u.type === 'waitress') return { ...GIRL_LOOK, skin: l % 2 };
  const L = lookBase(u);
  const kid = u.type === 'kid';
  if (u.sx === 'f' || kid) {
    const r = mulberry32(Math.imul(l + 57, 0x2c1b3c6d) ^ 0x9e37);
    const pick = n => Math.floor(r() * n);
    L.noBeard = true; L.nose = 3; L.brow = 0; L.braid = false;
    L.hair = FEM_HAIR[pick(FEM_HAIR.length)];
    if (u.sx === 'f') { L.fem = true; L.hs = pick(6); L.earring = pick(3) === 0; L.freckles = pick(5) === 0; }
    if (L.fem && /^hero/.test(u.type) && (L.hs === 2 || L.hs === 3)) L.hs = L.hs === 2 ? 0 : 4;   // героиня — косы и пучок под шлемом
    if (kid) { L.kid = true; L.capStyle = 8; L.deco = 5 + pick(3); L.freckles = pick(2) === 0; L.hair = KID_HAIR[pick(KID_HAIR.length)]; if (L.fem) L.hs = 0; }   // гномочки — с косичками
  }
  return L;
}
const KID_HAIR = ['#c9501c', '#e0b050', '#d08a40', '#a83a1c', '#8a4a1c'];   // у гномят светлее: тёмные пряди у лица читались как очки
const FEM_HAIR = ['#c9501c', '#8a4a1c', '#e0b050', '#5a3a22', '#2e2018', '#d08a40', '#a83a1c', '#7a5a3a'];
// причёски гномок: 0 две косы, 1 коса за спиной, 2 платок, 3 чепец, 4 пучок, 5 кудри
const FEM_HS_NAMES = ['Две косы', 'Коса', 'Платок', 'Чепец', 'Пучок', 'Кудри'];
function lookBase(u) {
  const l = u.look;
  const r = mulberry32(Math.imul(l + 101, 0x45d9f3b) ^ 0x2545);
  const pick = n => Math.floor(r() * n);
  const ench = u.type === 'enchanter';
  return {
    skin: pick(3),
    beard: ench ? 0 : pick(BEARDS.length),
    beardLen: ench ? 2 : 1 + pick(2),              // 1 до груди, 2 до ремня
    beardStyle: ench ? 2 : pick(5),                // 0 круглая, 1 раздвоенная, 2 клином, 3 лопатой, 4 козлиная бородка
    must: pick(3),                                 // усы: 0 пышные, 1 закрученные вверх, 2 моржовые, вниз
    nose: pick(3),                                 // 0 картошка, 1 слива, 2 остренький
    brow: pick(2),                                 // 1 — брови кустистые, торчат из-под колпака
    earring: pick(5) === 0,                        // золотое колечко в ухе
    freckles: pick(4) === 0,                       // веснушки на щеках
    braid: pick(4) === 0,                          // борода заплетена в косичку
    capTip: pick(2) ? 1 : -1,                      // в какую сторону свисает кончик
    green: GREENS[pick(GREENS.length)],
    deco: pick(8),                                 // 0 веточка, 1 листья, 2 грибок, 3 перо, 4 жёлудь, 5–7 без украшений
    serfCap: SERF_CAPS[pick(SERF_CAPS.length)],
    capStyle: pick(10),                            // форма колпака, см. capShape
  };
}

// ---------- Ноша ----------
// Рисуется вокруг (0,0) — центра груза, примерно 11×9 пикселей.

function drawLoad(c, g) {
  const ol = 'rgba(20,10,4,0.75)';
  c.lineWidth = 0.35; c.strokeStyle = ol;
  if (typeof g === 'string' && g.startsWith('tray:')) {   // поднос официантки: кружки и блюдо — что заказали гости
    ellipse(c, 0, 2.2, 6.4, 1.3, '#7a5430'); ellipse(c, 0, 1.8, 6.4, 1.2, '#b88c58');
    c.fillStyle = '#e8c050'; c.fillRect(-4.4, -2.2, 2.2, 3.4); c.fillStyle = '#fff8e0'; c.fillRect(-4.4, -2.6, 2.2, 1);
    const fd = g.slice(5), big = fd === 'chickenleg' || fd === 'steak';   // крупная еда на подносе выглядит крупной, колбаса и круассан — мелкие
    c.save(); c.translate(big ? 2.6 : 2.4, big ? 1.8 : 1.4); c.scale(big ? 1.6 : 0.8, big ? 1.6 : 0.8); innFoodSprite(c, fd, 0, 0); c.restore();
    return;
  }
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
    case 'chicken': {
      // ощипанная тушка
      ellipse(c, 0, 0.6, 4.6, 3.2, '#f0c8a0');
      ellipse(c, -0.6, -0.2, 3, 2, '#f6d8b8');
      line(c, 3.6, 1.4, 6, 3.4, '#e8bc94', 1.4); line(c, -3.6, 1.4, -6, 3.4, '#e8bc94', 1.4);
      ellipse(c, 6.2, 3.6, 0.9, 0.9, '#f6f2ea'); ellipse(c, -6.2, 3.6, 0.9, 0.9, '#f6f2ea');
      c.strokeStyle = ol; c.lineWidth = 0.4; c.beginPath(); c.ellipse(0, 0.6, 4.6, 3.2, 0, 0, Math.PI * 2); c.stroke();
      break;
    }
    case 'chickenleg':
      ellipse(c, -1, 0, 3.4, 2.6, '#c8803a'); line(c, 1.6, 1, 4.6, 3, '#f6f2ea', 1.2); ellipse(c, 4.8, 3.2, 0.9, 0.9, '#ffffff');
      break;
    case 'trash': {
      // мешок с мусором, торчат объедки и щепки
      c.fillStyle = lingrad(c, -4, 0, 4, 0, [[0, '#8a7a5a'], [1, '#5a4a32']]);
      c.beginPath(); c.moveTo(-4.4, 4); c.quadraticCurveTo(-5.4, -2, -2, -3.4); c.lineTo(2, -3.4); c.quadraticCurveTo(5.4, -2, 4.4, 4); c.closePath(); c.fill();
      c.strokeStyle = ol; c.lineWidth = 0.4; c.stroke();
      line(c, -1, -3.4, -2.4, -6, '#e0b882', 0.8); ellipse(c, 1.4, -4, 1.2, 0.8, '#73963e'); ellipse(c, -0.2, -4.6, 0.8, 0.6, '#b6ada0');
      break;
    }
    case 'ash': {
      c.fillStyle = lingrad(c, -4, 0, 4, 0, [[0, '#b6ada0'], [1, '#706960']]);
      c.beginPath(); c.moveTo(-4, 4); c.quadraticCurveTo(-4.6, -1.6, -1.4, -3); c.lineTo(1.4, -3); c.quadraticCurveTo(4.6, -1.6, 4, 4); c.closePath(); c.fill();
      c.strokeStyle = ol; c.lineWidth = 0.4; c.stroke();
      c.fillStyle = '#5a3a1e'; c.fillRect(-1.6, -3.6, 3.2, 0.8);
      ellipse(c, 0, -4.2, 1.6, 0.7, '#cec6ba');
      break;
    }
    case 'mushroom':
      c.fillStyle = '#efe6d0'; c.fillRect(-1.2, -1, 2.4, 4);
      c.fillStyle = '#c8341e'; c.beginPath(); c.ellipse(0, -1, 4, 3, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#fff6ea'; c.fillRect(-2, -3, 1.2, 1); c.fillRect(1, -2.6, 1, 1);
      break;
    case 'hops':
      for (const [x, y] of [[-3, -1], [0, -2], [3, -1], [-1.5, 1], [1.8, 1]]) { ellipse(c, x, y, 1.6, 2, '#8ab048'); ellipse(c, x - 0.4, y - 0.6, 0.7, 0.8, '#c8e080'); }
      line(c, -4, -3, 4, -3, '#5a3a1e', 0.5);
      break;
    case 'tray': {
      // поднос с кружками и тарелкой
      ellipse(c, 0, 2.2, 6.4, 1.3, '#7a5430'); ellipse(c, 0, 1.8, 6.4, 1.2, '#b88c58');
      c.fillStyle = '#e8c050'; c.fillRect(-4.4, -2.2, 2.2, 3.4); c.fillStyle = '#fff8e0'; c.fillRect(-4.4, -2.6, 2.2, 1);
      c.fillStyle = '#e8c050'; c.fillRect(-1.6, -1.6, 2, 3); c.fillStyle = '#fff8e0'; c.fillRect(-1.6, -2, 2, 0.9);
      ellipse(c, 3.2, 0.9, 2.4, 0.9, '#e8e4da'); ellipse(c, 3.2, 0.2, 1.5, 0.7, '#b8742c');
      break;
    }
    case 'beer': case 'darkbeer':
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
    case 'bread': case 'croissant': case 'steak': case 'sausage': case 'goldore': case 'magicstone': {
      c.fillStyle = lingrad(c, -4.5, 0, 4.5, 0, [[0, '#c89a58'], [1, '#6a4a22']]);
      c.beginPath(); c.moveTo(-4.6, -0.6); c.lineTo(-3.6, 3); c.lineTo(3.6, 3); c.lineTo(4.6, -0.6); c.closePath(); c.fill(); c.stroke();
      for (let k = 0; k < 3; k++) line(c, -4.2, 0.4 + k, 4.2, 0.4 + k, 'rgba(70,45,15,0.6)', 0.25);
      if (g === 'croissant') { ellipse(c, -2, -1, 2.2, 1.2, '#d89a3c'); ellipse(c, 1.8, -1.2, 2.2, 1.3, '#c88a30'); }
      if (g === 'steak') { ellipse(c, -1.5, -1, 2.4, 1.5, '#b8402c'); ellipse(c, 2, -1.2, 2, 1.3, '#a83a28'); }
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

// Несколько единиц груза — стопкой, одна на другой (трудяги 2-го и 3-го уровня)
function drawLoads(c, g, n) {
  if (n <= 1) { drawLoad(c, g); return; }
  const step = g === 'trunk' || g === 'timber' ? 4.4 : 3.2;
  for (let k = n - 1; k >= 0; k--) {
    c.save(); c.translate((k % 2 ? 0.5 : -0.3) * (k ? 1 : 0), -(n - 1 - k) * step + (n - 1) * step * 0.35); drawLoad(c, g); c.restore();
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
let MOSS_OFF = false;   // дикие гномы (wildart.js): мох только у лесной фракции

// Мох крапинками внутри текущего контура (вызывать после clip)
function mossSpeckle(c, x0, y0, w, h, density, r) {
  if (MOSS_OFF) return;
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
// Мшистый колпак натянут по самые брови — глаз не видно, торчит только нос.
// Десять форм, цвет всегда профессии:
//  0 завиток вбок          5 дважды переломленный, зигзагом
//  1 прямой конус          6 широкий блин с пупочкой (шляпка гриба)
//  2 мягкий мешок до уха   7 штопор — кончик закручен петлёй
//  3 короткий фригийский   8 коротышка с помпоном
//  4 длинный ночной, кончик свисает до плеча   9 раздвоенный, на два рожка

function capShape(c, hx, b, s, tall, style) {
  const X = k => hx + k * s;
  c.beginPath();
  c.moveTo(X(-4.3), b);
  if (style === 1) {
    c.quadraticCurveTo(X(-3.2), b - tall * 0.55, X(1.4), b - tall);
    c.quadraticCurveTo(X(3.4), b - tall * 0.5, X(4.3), b);
  } else if (style === 2) {
    c.quadraticCurveTo(X(-4.8), b - tall * 0.85, X(0.6), b - tall * 0.9);
    c.quadraticCurveTo(X(5.6), b - tall * 0.95, X(6.4), b - tall * 0.35);
    c.quadraticCurveTo(X(6.9), b + 0.2, X(5.6), b + 1.4);
    c.quadraticCurveTo(X(4.9), b - tall * 0.2, X(3.9), b - tall * 0.45);
    c.quadraticCurveTo(X(4.5), b - tall * 0.2, X(4.3), b);
  } else if (style === 3) {
    c.quadraticCurveTo(X(-4.4), b - tall * 0.95, X(0.6), b - tall);
    c.quadraticCurveTo(X(3.8), b - tall * 1.05, X(4.4), b - tall * 0.62);
    c.quadraticCurveTo(X(3.2), b - tall * 0.7, X(3.3), b - tall * 0.45);
    c.quadraticCurveTo(X(4.5), b - tall * 0.25, X(4.3), b);
  } else if (style === 4) {
    // длинный ночной колпак: тянется вверх, переламывается и свисает вдоль уха до плеча
    c.quadraticCurveTo(X(-4.6), b - tall * 0.7, X(-0.4), b - tall * 0.96);
    c.quadraticCurveTo(X(3.6), b - tall * 1.02, X(5.8), b - tall * 0.5);
    c.quadraticCurveTo(X(7.6), b - tall * 0.05, X(7.2), b + 5.6);
    c.quadraticCurveTo(X(6.2), b + 2, X(4.8), b - tall * 0.34);
    c.quadraticCurveTo(X(4.7), b - tall * 0.1, X(4.3), b);
  } else if (style === 5) {
    // зигзаг: середина уходит вбок, кончик возвращается обратно
    c.quadraticCurveTo(X(-3.4), b - tall * 0.3, X(0.4), b - tall * 0.56);
    c.quadraticCurveTo(X(-0.8), b - tall * 0.8, X(-2.4), b - tall * 1.02);
    c.quadraticCurveTo(X(0.8), b - tall * 0.95, X(4.8), b - tall * 0.5);
    c.quadraticCurveTo(X(5.6), b - tall * 0.2, X(4.3), b);
  } else if (style === 6) {
    // блин: широкие мягкие поля нависают над ушами, сверху пупочка
    c.quadraticCurveTo(X(-7.6), b - tall * 0.12, X(-6.4), b - tall * 0.42);
    c.quadraticCurveTo(X(-3), b - tall * 0.78, X(-0.5), b - tall * 0.7);
    c.lineTo(X(-0.3), b - tall * 0.98); c.lineTo(X(1.1), b - tall * 0.98); c.lineTo(X(0.9), b - tall * 0.7);
    c.quadraticCurveTo(X(4), b - tall * 0.78, X(6.4), b - tall * 0.42);
    c.quadraticCurveTo(X(7.6), b - tall * 0.12, X(4.3), b);
  } else if (style === 7) {
    // штопор: конус, а кончик завит петлёй
    c.quadraticCurveTo(X(-3.8), b - tall * 0.6, X(0.4), b - tall * 0.8);
    c.quadraticCurveTo(X(3.2), b - tall * 1.18, X(4.8), b - tall * 0.92);
    c.quadraticCurveTo(X(5.6), b - tall * 0.64, X(3.4), b - tall * 0.62);
    c.quadraticCurveTo(X(2.2), b - tall * 0.66, X(2.8), b - tall * 0.8);
    c.quadraticCurveTo(X(4.8), b - tall * 0.42, X(4.3), b);
  } else if (style === 8) {
    // коротышка: круглый куполок, на верхушке помпон (рисуется отдельно)
    c.quadraticCurveTo(X(-4.2), b - tall * 0.78, X(1.2), b - tall * 0.9);
    c.quadraticCurveTo(X(4.4), b - tall * 0.7, X(4.3), b);
  } else if (style === 9) {
    // два рожка в стороны
    c.quadraticCurveTo(X(-6.6), b - tall * 0.5, X(-5.4), b - tall * 0.92);
    c.quadraticCurveTo(X(-2.6), b - tall * 0.56, X(0), b - tall * 0.48);
    c.quadraticCurveTo(X(2.6), b - tall * 0.56, X(5.4), b - tall * 0.92);
    c.quadraticCurveTo(X(6.6), b - tall * 0.5, X(4.3), b);
  } else {
    c.quadraticCurveTo(X(-4.4), b - tall * 0.62, X(-0.8), b - tall * 0.88);
    c.quadraticCurveTo(X(2.4), b - tall * 1.12, X(5.8), b - tall * 0.86);
    c.quadraticCurveTo(X(7.4), b - tall * 0.72, X(7.4), b - tall * 0.42);
    c.quadraticCurveTo(X(6.2), b - tall * 0.66, X(3.8), b - tall * 0.7);
    c.quadraticCurveTo(X(4.6), b - tall * 0.34, X(4.3), b);
  }
  c.closePath();
}

const CAP_TALL = [10.5, 11.5, 9.5, 8.5, 11, 11.5, 8, 10.5, 7.5, 9.5];

// Перо и жёлудь на колпаке
function feather(c, x, y, dir) {
  c.save(); c.translate(x, y); c.rotate(dir * 0.55);
  c.fillStyle = '#e4d6b4'; c.beginPath(); c.ellipse(0, -3.4, 1.1, 3.6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#8a5a2a'; c.beginPath(); c.ellipse(0, -6.2, 0.9, 1.2, 0, 0, Math.PI * 2); c.fill();
  line(c, 0, 0.4, 0, -6.6, '#9a7a4a', 0.3);
  c.restore();
}
function acorn(c, x, y) {
  ellipse(c, x, y - 0.6, 1, 1.3, '#a87838'); ellipse(c, x, y - 1.5, 1.2, 0.7, '#5a3a1e'); line(c, x, y - 2, x, y - 2.8, '#5a3a1e', 0.4);
  ellipse(c, x - 0.3, y - 0.7, 0.3, 0.5, 'rgba(255,230,180,0.6)');
}

function drawCap(c, O, view, hx, hy, tipSway, L, r, lvl = 1) {
  const e = view === 'E';
  const b = hy - 1.1;                         // край натянут на глаза
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
  if (O.cap === 'waitress') {
    // рыжая шевелюра, белая повязка в красный горошек и бантик
    c.fillStyle = lingrad(c, hx - 4.5, 0, hx + 4.5, 0, [[0, HAIR_L], [0.5, HAIR], [1, HAIR_D]]);
    c.beginPath(); c.ellipse(hx, hy - 0.8, 4.5, 3.9, 0, Math.PI, 0); c.fill();
    if (!e) { c.beginPath(); c.moveTo(hx - 4.4, hy - 0.6); c.quadraticCurveTo(hx - 1.5, hy - 2.6, hx + 1, hy - 1.2); c.quadraticCurveTo(hx + 3, hy - 2.4, hx + 4.4, hy - 0.6); c.lineTo(hx + 4.4, hy - 1.6); c.lineTo(hx - 4.4, hy - 1.6); c.closePath(); c.fill(); }
    if (view === 'N') ellipse(c, hx, hy + 0.2, 4.2, 3.6, HAIR);
    c.fillStyle = '#f6f1e4'; rrect(c, hx - 4.6, hy - 2.7, 9.2, 1.5, 0.7); c.fill();
    c.fillStyle = '#d83a3a'; for (let k = 0; k < 4; k++) c.fillRect(hx - 3.4 + k * 2.3, hy - 2.3, 0.7, 0.7);
    const bx = e ? hx - 2.4 : hx + 3.6;
    poly(c, [[bx, hy - 3.7], [bx - 2, hy - 5], [bx - 2, hy - 2.6]], '#d82e3a'); poly(c, [[bx, hy - 3.7], [bx + 2, hy - 5], [bx + 2, hy - 2.6]], '#e8505a');
    ellipse(c, bx, hy - 3.7, 0.7, 0.7, '#a01c28');
    return;
  }
  const wizard = O.cap === 'wizard';
  const col = wizard ? '#4c3080' : O.cap === 'serf' ? L.serfCap : O.cap;
  // гномка в платке или чепце: цвет профессии остаётся на ткани / ленте
  if (L.fem && (L.hs === 2 || L.hs === 3) && !wizard && typeof col === 'string' && col[0] === '#') { drawKerchief(c, view, hx, hy, col, L.hs === 3); return; }
  const style = wizard ? 1 : L.capStyle;
  const tall = wizard ? 13 : CAP_TALL[style];
  const s = e ? -1 : L.capTip;               // боком кончик свисает назад
  if (wizard) ellipse(c, hx, b + 0.6, 5.6, 1.6, shade(col, -0.35));
  // конус
  c.save();
  capShape(c, hx + tipSway * 0.3, b, s, tall, style);
  c.fillStyle = lingrad(c, hx - 4.5, 0, hx + 5, 0, [[0, shade(col, 0.25)], [0.5, col], [1, shade(col, -0.4)]]);
  c.fill();
  c.clip();
  // у трудяг колпак весь во мху, у остальных мох лишь налётом — цвет профессии читается
  const mossy = O.cap === 'serf' && !L.kid;
  if (!wizard && !L.kid) mossSpeckle(c, hx - 8, b - tall * 1.2, 16, tall * 1.2 + 7, mossy ? 0.55 : 0.14, r);
  if (L.kid) { c.fillStyle = shade(col, 0.4); for (let k = 0; k < 3; k++) c.fillRect(hx - 6, b - 2.6 - k * 2.2, 12, 0.8); }   // вязаная шапочка в полоску
  // складки
  c.strokeStyle = shade(col, -0.35); c.lineWidth = 0.35;
  c.beginPath(); c.moveTo(hx - 1.4 * s, b); c.quadraticCurveTo(hx - 1 * s, b - tall * 0.5, hx + 0.6 * s, b - tall * 0.8); c.stroke();
  c.beginPath(); c.moveTo(hx + 2 * s, b); c.quadraticCurveTo(hx + 2.4 * s, b - tall * 0.3, hx + 3.2 * s, b - tall * 0.62); c.stroke();
  // нашивки за выслугу: золотые полоски над отворотом (2-й и 3-й уровень трудяг и работяг)
  if (lvl > 1) for (let k = 0; k < lvl - 1; k++) { c.fillStyle = '#e8c040'; c.fillRect(hx - 6, b - 2.9 - k * 1.5, 12, 0.8); c.fillStyle = 'rgba(120,80,0,0.45)'; c.fillRect(hx - 6, b - 2.1 - k * 1.5, 12, 0.3); }
  c.restore();
  // помпон и жёлуди на рожках — тем же цветом, что колпак, светлее
  if (style === 8) { ellipse(c, hx + 1.4 * s + tipSway * 0.3, b - tall * 0.98, 2, 1.9, shade(col, 0.3)); ellipse(c, hx + 0.8 * s + tipSway * 0.3, b - tall * 1.08, 0.8, 0.7, shade(col, 0.55)); }
  if (style === 4) { ellipse(c, hx + 7.2 * s + tipSway * 0.3, b + 6.2, 1.5, 1.4, shade(col, 0.3)); ellipse(c, hx + 6.8 * s + tipSway * 0.3, b + 5.8, 0.6, 0.5, shade(col, 0.55)); }
  if (style === 9 && !wizard) { acorn(c, hx - 5.4 * s + tipSway * 0.3, b - tall * 0.9 + 1.2); acorn(c, hx + 5.4 * s + tipSway * 0.3, b - tall * 0.9 + 1.2); }
  // толстый подвёрнутый край, весь во мху
  c.save();
  rrect(c, hx - 4.9, b - 1.4, 9.8, 3, 1.5);
  c.fillStyle = lingrad(c, 0, b - 1.4, 0, b + 1.6, [[0, shade(col, 0.15)], [1, shade(col, -0.35)]]);
  c.fill();
  c.clip();
  if (!wizard && !L.kid) mossSpeckle(c, hx - 5, b - 1.6, 10, 3.4, mossy ? 1.4 : 0.45, r);
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
    else if (L.deco === 3) feather(c, hx - 3.4 * (e ? -1 : 1), b - 0.8, e ? 1 : -1);
    else if (L.deco === 4) acorn(c, hx - 3.2 * (e ? -1 : 1), b - 0.4);
  }
  if (O.candle && view !== 'N') {
    const cx = e ? hx + 2.6 : hx;
    c.fillStyle = '#b08a3a'; c.fillRect(cx - 0.9, b - 1, 1.8, 0.9);
    c.fillStyle = '#efe6d0'; c.fillRect(cx - 0.55, b - 3.6, 1.1, 2.6);
    drawFire(c, cx, b - 3.4, 'tiny', Game.time, cx * 3, { glow: 0 });
  }
  if (O.dusty) { c.fillStyle = 'rgba(255,255,255,0.8)'; for (let k = 0; k < 5; k++) c.fillRect(hx - 2 + k * 1.1, b - 3 - k * 1.3, 0.45, 0.45); }
}

// Платок (узелок под подбородком, белый горошек) или чепец (белый с оборкой, лента цвета профессии)
function drawKerchief(c, view, hx, hy, col, bonnet) {
  const e = view === 'E', cloth = bonnet ? '#f4efe2' : col, dk = shade(cloth, -0.32);
  c.fillStyle = lingrad(c, hx - 5, 0, hx + 5, 0, [[0, shade(cloth, 0.2)], [0.55, cloth], [1, dk]]);
  c.beginPath();
  if (view === 'S') { c.moveTo(hx - 4.5, hy + 1.6); c.quadraticCurveTo(hx - 5.2, hy - 5.6, hx, hy - 5.9); c.quadraticCurveTo(hx + 5.2, hy - 5.6, hx + 4.5, hy + 1.6); c.quadraticCurveTo(hx + 3.6, hy - 1.6, hx, hy - 1.6); c.quadraticCurveTo(hx - 3.6, hy - 1.6, hx - 4.5, hy + 1.6); }
  else if (e) { c.moveTo(hx + 3.4, hy - 1.2); c.quadraticCurveTo(hx + 3, hy - 5.8, hx - 1.4, hy - 5.6); c.quadraticCurveTo(hx - 4.8, hy - 4.6, hx - 4.6, hy + 0.8); c.lineTo(hx - 2.4, hy + 2.2); c.quadraticCurveTo(hx - 1, hy - 1.4, hx + 3.4, hy - 1.2); }
  else { c.moveTo(hx - 4.6, hy + 1); c.quadraticCurveTo(hx - 5.2, hy - 5.6, hx, hy - 5.9); c.quadraticCurveTo(hx + 5.2, hy - 5.6, hx + 4.6, hy + 1); c.lineTo(hx, hy + (bonnet ? 2 : 5)); c.closePath(); }
  c.fill();
  if (bonnet) {
    // оборка по краю и лента
    for (let k = 0; k < 7; k++) { const a = Math.PI * (0.05 + k * 0.15); ellipse(c, hx - Math.cos(a) * (e ? 3.6 : 4.6) + (e ? 0.4 : 0), hy - 1.2 - Math.sin(a) * 4.4, 0.9, 0.8, '#ffffff'); }
    if (view !== 'N') { line(c, hx + (e ? 1 : -3.6), hy + 1, hx + (e ? 2.2 : 0), hy + 4.6, col, 0.7); if (!e) line(c, hx + 3.6, hy + 1, hx, hy + 4.6, col, 0.7); ellipse(c, hx + (e ? 2.2 : 0), hy + 4.8, 1.2, 0.7, col); }
  } else {
    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (const [dx, dy] of [[-2.6, -3.4], [0, -4.6], [2.6, -3.4], [-1.3, -2.2], [1.3, -2.2]]) c.fillRect(hx + dx * (e ? 0.8 : 1) - (e ? 0.6 : 0), hy + dy, 0.6, 0.6);
    if (view === 'S') { poly(c, [[hx - 0.2, hy + 4], [hx - 2.2, hy + 5.4], [hx - 1.4, hy + 3.6]], dk); poly(c, [[hx + 0.2, hy + 4], [hx + 2.2, hy + 5.4], [hx + 1.4, hy + 3.6]], dk); ellipse(c, hx, hy + 4, 0.8, 0.7, cloth); }
    if (e) poly(c, [[hx - 4.2, hy + 0.2], [hx - 6.2, hy + 3.4], [hx - 3.4, hy + 2]], dk);   // кончики узла сзади
  }
}

// ---------- Голова ----------

function drawEar(c, x, y, dir, sk) {
  poly(c, [[x, y - 1], [x + dir * 3.6, y - 2.6], [x + dir * 0.4, y + 1.6]], sk[1], shade(sk[2], -0.2), 0.3);
  poly(c, [[x + dir * 0.4, y - 0.6], [x + dir * 2.6, y - 1.8], [x + dir * 0.6, y + 0.9]], sk[2]);
}

function drawBeard(c, view, hx, hy, L, type, bottom, r) {
  const bc = type === 'enchanter' ? '#f0ece4' : (L.bcol || BEARDS[L.beard]);
  const st = L.beardStyle || 0, mid = (hy + bottom) / 2 + 1;
  c.save();
  c.beginPath();
  if (view === 'S') {
    // борода начинается ниже щёк и носа; форма — по beardStyle
    if (st === 4) {
      // козлиная бородка: только на подбородке, щёки голые
      c.moveTo(hx - 2.2, hy + 2.6);
      c.quadraticCurveTo(hx - 2.6, bottom - 1, hx, bottom + 0.6);
      c.quadraticCurveTo(hx + 2.6, bottom - 1, hx + 2.2, hy + 2.6);
      c.quadraticCurveTo(hx, hy + 3.4, hx - 2.2, hy + 2.6);
    } else {
      c.moveTo(hx - 3.8, hy + 1);
      if (st === 1) {          // раздвоенная: два кончика и выемка между ними
        c.quadraticCurveTo(hx - 5, mid, hx - 2.8, bottom + 0.6);
        c.quadraticCurveTo(hx - 1.2, bottom - 1.4, hx, bottom - 2.4);
        c.quadraticCurveTo(hx + 1.2, bottom - 1.4, hx + 2.8, bottom + 0.6);
        c.quadraticCurveTo(hx + 5, mid, hx + 3.8, hy + 1);
      } else if (st === 2) {   // клином: сходится в одну точку
        c.quadraticCurveTo(hx - 4.4, mid - 1, hx, bottom + 1.4);
        c.quadraticCurveTo(hx + 4.4, mid - 1, hx + 3.8, hy + 1);
      } else if (st === 3) {   // лопатой: широкая, срезана ровно
        c.quadraticCurveTo(hx - 5.2, mid, hx - 4.4, bottom - 0.6);
        c.quadraticCurveTo(hx - 3.6, bottom + 0.6, hx - 2.6, bottom + 0.6);
        c.lineTo(hx + 2.6, bottom + 0.6);
        c.quadraticCurveTo(hx + 3.6, bottom + 0.6, hx + 4.4, bottom - 0.6);
        c.quadraticCurveTo(hx + 5.2, mid, hx + 3.8, hy + 1);
      } else {                 // круглая
        c.quadraticCurveTo(hx - 4.9, mid, hx - 1.6, bottom - 0.4);
        c.quadraticCurveTo(hx, bottom + 0.8, hx + 1.6, bottom - 0.4);
        c.quadraticCurveTo(hx + 4.9, mid, hx + 3.8, hy + 1);
      }
      c.quadraticCurveTo(hx, hy + 3.2, hx - 3.8, hy + 1);
    }
  } else if (st === 4) {
    c.moveTo(hx + 1.4, hy + 2.6);
    c.quadraticCurveTo(hx + 1.6, bottom - 1, hx + 3, bottom + 0.4);
    c.quadraticCurveTo(hx + 4.6, bottom - 1.2, hx + 4.4, hy + 2.6);
  } else {
    c.moveTo(hx - 0.6, hy + 1.4);
    if (st === 2 || st === 1) {
      c.quadraticCurveTo(hx - 0.8, mid - 1, hx + 2.4, bottom + 1.2);
      c.quadraticCurveTo(hx + 4.6, mid - 1, hx + 4, hy + 2.2);
    } else if (st === 3) {
      c.quadraticCurveTo(hx - 1, mid, hx + 0.6, bottom + 0.4);
      c.lineTo(hx + 4.6, bottom + 0.4);
      c.quadraticCurveTo(hx + 4.8, mid, hx + 4, hy + 2.2);
    } else {
      c.quadraticCurveTo(hx - 0.8, (hy + bottom) / 2, hx + 1, bottom);
      c.quadraticCurveTo(hx + 4.2, bottom - 1.6, hx + 4, hy + 2.2);
    }
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
  for (let k = 0; k < (MOSS_OFF ? 0 : 26); k++) {
    const t = r(), side = r() < 0.5 ? -1 : 1;
    const x = view === 'S' ? hx + side * (2.4 + r() * 2.2) : hx + r() * 4, y = hy + 1 + t * (bottom - hy);
    c.fillStyle = MOSS[(r() * 4) | 0]; c.globalAlpha = 0.45 + r() * 0.4;
    c.fillRect(x, y, 0.6, 0.5);
  }
  c.globalAlpha = 1;
  c.restore();
  if (L.braid && view === 'S' && st !== 4) {
    if (st === 1) for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) ellipse(c, hx + sd * 2.8, bottom + 1.4 + k * 1.1, 0.75, 0.6, shade(bc, -0.08 * k));
    else for (let k = 0; k < 3; k++) ellipse(c, hx, bottom + (st === 2 ? 1.8 : 0.8) + k * 1.1, 0.8, 0.65, shade(bc, -0.08 * k));
    // бусина на конце косички
    ellipse(c, hx + (st === 1 ? -2.8 : 0), bottom + (st === 1 ? 3.4 : st === 2 ? 4.8 : 3.8), 0.7, 0.7, '#c8a050');
  }
  return bc;
}

// Усы: 0 пышные, 1 закрученные вверх (гусарские), 2 моржовые — свисают вниз
function drawMoustache(c, view, hx, hy, bc, must) {
  const m = must || 0;
  if (view === 'E') {
    if (m === 1) { ellipse(c, hx + 3, hy + 3.2, 1.7, 0.8, shade(bc, 0.1)); c.strokeStyle = shade(bc, 0.1); c.lineWidth = 0.7; c.beginPath(); c.moveTo(hx + 4.4, hy + 3); c.quadraticCurveTo(hx + 6.2, hy + 3, hx + 5.8, hy + 1.4); c.stroke(); }
    else if (m === 2) { c.save(); c.translate(hx + 3.4, hy + 3.6); c.rotate(0.5); ellipse(c, 0, 0, 2.3, 0.8, shade(bc, 0.1)); c.restore(); ellipse(c, hx + 5.2, hy + 5.6, 0.7, 0.9, shade(bc, 0.05)); }
    else ellipse(c, hx + 3, hy + 3.4, 1.9, 0.9, shade(bc, 0.1));
    return;
  }
  if (m === 1) {
    ellipse(c, hx - 1.6, hy + 3.4, 1.7, 0.8, shade(bc, 0.12)); ellipse(c, hx + 1.6, hy + 3.4, 1.7, 0.8, shade(bc, 0.05));
    c.strokeStyle = shade(bc, 0.1); c.lineWidth = 0.7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx - 3, hy + 3.2); c.quadraticCurveTo(hx - 4.8, hy + 3.2, hx - 4.4, hy + 1.6); c.stroke();
    c.beginPath(); c.moveTo(hx + 3, hy + 3.2); c.quadraticCurveTo(hx + 4.8, hy + 3.2, hx + 4.4, hy + 1.6); c.stroke();
    c.lineCap = 'butt';
  } else if (m === 2) {
    for (const sd of [-1, 1]) { c.save(); c.translate(hx + sd * 2.2, hy + 3.8); c.rotate(sd * 0.55); ellipse(c, 0, 0, 2.4, 0.85, shade(bc, sd < 0 ? 0.12 : 0.05)); c.restore(); ellipse(c, hx + sd * 4.2, hy + 5.8, 0.7, 1, shade(bc, 0.02)); }
  } else {
    ellipse(c, hx - 1.9, hy + 3.5, 2.1, 1, shade(bc, 0.12)); ellipse(c, hx + 1.9, hy + 3.5, 2.1, 1, shade(bc, 0.05));
  }
}

// Нос: 0 картошка, 1 слива (большой, красноватый), 2 остренький, 3 кнопочка (гномки, гномята)
function drawNose(c, view, hx, hy, sk, nose) {
  const n = nose || 0;
  if (n === 3) {   // гномки и гномята: маленькая кнопочка
    if (view === 'E') { ellipse(c, hx + 3.7, hy + 1.9, 1, 0.9, sk[1]); ellipse(c, hx + 3.5, hy + 1.6, 0.35, 0.3, 'rgba(255,240,220,0.75)'); }
    else { ellipse(c, hx, hy + 2, 1.05, 0.9, sk[1]); ellipse(c, hx - 0.35, hy + 1.7, 0.35, 0.3, 'rgba(255,240,220,0.75)'); }
    return;
  }
  if (view === 'E') {
    if (n === 1) { ellipse(c, hx + 4.2, hy + 2.1, 2.2, 1.9, shade(sk[1], -0.04)); ellipse(c, hx + 4.4, hy + 2.6, 1.5, 1, 'rgba(200,80,70,0.35)'); ellipse(c, hx + 3.6, hy + 1.3, 0.6, 0.5, 'rgba(255,240,220,0.75)'); }
    else if (n === 2) { poly(c, [[hx + 2.4, hy + 0.8], [hx + 5.8, hy + 2.6], [hx + 2.6, hy + 3]], sk[1]); ellipse(c, hx + 3.2, hy + 1.4, 0.45, 0.4, 'rgba(255,240,220,0.75)'); }
    else { ellipse(c, hx + 4, hy + 1.9, 1.8, 1.5, sk[1]); ellipse(c, hx + 3.5, hy + 1.4, 0.55, 0.45, 'rgba(255,240,220,0.75)'); }
    return;
  }
  if (n === 1) { ellipse(c, hx, hy + 2.2, 2.3, 2, sk[1]); ellipse(c, hx, hy + 2.9, 1.7, 1.1, 'rgba(200,80,70,0.4)'); ellipse(c, hx - 0.7, hy + 1.5, 0.7, 0.55, 'rgba(255,240,220,0.75)'); }
  else if (n === 2) { poly(c, [[hx - 1.1, hy + 0.9], [hx + 1.1, hy + 0.9], [hx + 0.3, hy + 3.6]], sk[1]); ellipse(c, hx - 0.3, hy + 1.5, 0.45, 0.4, 'rgba(255,240,220,0.75)'); }
  else { ellipse(c, hx, hy + 2, 1.9, 1.6, sk[1]); ellipse(c, hx, hy + 2.6, 1.4, 0.9, shade(sk[1], -0.1)); ellipse(c, hx - 0.6, hy + 1.5, 0.6, 0.5, 'rgba(255,240,220,0.75)'); }
}

function drawEarring(c, x, y) {
  c.strokeStyle = '#e8c040'; c.lineWidth = 0.45; c.beginPath(); c.arc(x, y, 0.8, 0, Math.PI * 2); c.stroke();
}

function drawFreckles(c, hx, hy, sk, side) {
  c.fillStyle = shade(sk[2], -0.15);
  for (const [dx, dy] of [[-1.2, 0.9], [-0.2, 1.4], [-1.6, 1.7], [0.3, 0.6]]) c.fillRect(hx + side * (2.4 + dx * 0.9) - 0.2, hy + dy, 0.45, 0.45);
}

// Волосы гномки: косы, кудри, пучок. hc — [свет, тон, тень]; n — длина косы в звеньях (у гномят короче).
function femHairCols(O, L) { return O.fem ? [HAIR_L, HAIR, HAIR_D] : [shade(L.hair, 0.22), L.hair, shade(L.hair, -0.32)]; }
function femBraid(c, x0, y0, dx, n, H, bow) {
  for (let k = 0; k < n; k++) { const bx = x0 + dx * k, by = y0 + k * 1.75; ellipse(c, bx, by, 1.15, 1.05, k % 2 ? H[1] : H[0]); ellipse(c, bx + 0.1, by + 0.35, 0.7, 0.5, H[2]); }
  ellipse(c, x0 + dx * n - dx * 0.3, y0 + n * 1.75 - 1.6, 1.1, 0.9, bow);
  ellipse(c, x0 + dx * n, y0 + n * 1.75 - 0.6, 0.9, 0.9, H[0]);
}
function femHair(c, view, hx, hy, L, O) {
  const H = femHairCols(O, L), hs = O.fem ? 0 : L.hs, n = L.kid ? 3 : 6, bow = O.fem ? '#d82e3a' : shade(L.serfCap || '#d82e3a', 0.15);
  if (view === 'S') {
    if (hs === 0) for (const sd of [-1, 1]) femBraid(c, hx + sd * 4.5, hy + (L.kid ? 2.4 : 1.2), -sd * 0.12, n, H, bow);
    else if (hs === 5) for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) ellipse(c, hx + sd * (4 - k * 0.3), hy + 0.4 + k * 1.5, 1.4, 1.2, k % 2 ? H[1] : H[0]);
    else if (hs !== 2) for (const sd of [-1, 1]) { ellipse(c, hx + sd * 4.5, hy + 1.8, 0.8, 1.7, H[1]); ellipse(c, hx + sd * 4.4, hy + 1.2, 0.45, 0.8, H[0]); }   // пряди у висков — за краем лица, не на глазах
  } else if (view === 'E') {
    if (hs === 0 || hs === 1) for (let k = 0; k < n; k++) ellipse(c, hx - 3 - k * 0.1, hy + 1.2 + k * 1.75, 1.1, 1, k % 2 ? H[1] : H[0]);
    if (hs === 0 || hs === 1) ellipse(c, hx - 3.5, hy + 1.2 + n * 1.75 - 1, 1, 0.9, bow);
    if (hs === 4) { ellipse(c, hx - 3.6, hy - 1.6, 2, 1.9, H[1]); ellipse(c, hx - 4, hy - 2.1, 0.8, 0.7, H[0]); }
    if (hs === 5) for (let k = 0; k < 3; k++) ellipse(c, hx - 3.2, hy - 0.6 + k * 1.6, 1.5, 1.3, k % 2 ? H[1] : H[0]);
  } else {
    if (hs === 0) for (const sd of [-1, 1]) { for (let k = 0; k < n; k++) ellipse(c, hx + sd * (1.4 + 0.1 * k), hy + 3 + k * 1.75, 1.1, 1.05, k % 2 ? H[1] : H[0]); ellipse(c, hx + sd * 2, hy + 3 + n * 1.75 - 0.2, 1, 0.9, bow); }
    else if (hs === 1) { for (let k = 0; k < n + 1; k++) ellipse(c, hx, hy + 3 + k * 1.75, 1.2, 1.05, k % 2 ? H[1] : H[0]); ellipse(c, hx, hy + 3 + (n + 1) * 1.75 - 0.2, 1, 0.9, bow); }
    else if (hs === 4) { ellipse(c, hx, hy - 1.4, 2.2, 2, H[1]); ellipse(c, hx - 0.6, hy - 2, 0.8, 0.7, H[0]); }
    else if (hs === 5) for (const sd of [-1, 0, 1]) ellipse(c, hx + sd * 2.6, hy + 3.4, 1.6, 1.4, sd ? H[1] : H[0]);
  }
}

function drawHead(c, view, hx, hy, L, O, type, pipe, bottom, r) {
  const sk = SKINS[L.skin];
  const R = 3.8;
  const fem = O.fem || L.fem, nob = fem || L.noBeard;
  const hc = O.fem ? HAIR : L.hair;
  const nose = O.fem ? 3 : L.nose;
  if (view === 'S') {
    drawEar(c, hx - 3.4, hy + 0.2, -1, sk); drawEar(c, hx + 3.4, hy + 0.2, 1, sk);
    c.fillStyle = radgrad(c, hx - 1, hy - 1, 0.4, R * 1.5, [[0, sk[0]], [0.7, sk[1]], [1, sk[2]]]);
    c.beginPath(); c.ellipse(hx, hy, R, R * 1.02, 0, 0, Math.PI * 2); c.fill();
    const bc = nob ? hc : drawBeard(c, 'S', hx, hy, L, type, bottom, r);
    if (O.skBeard >= 0 && !nob) skinBeard(c, O.skBeard, 'S', hx, hy);
    // пухлые румяные щёки
    ellipse(c, hx - 2.4, hy + 1.1, 1.5, 1.2, sk[0]); ellipse(c, hx + 2.4, hy + 1.1, 1.5, 1.2, sk[0]);
    ellipse(c, hx - 2.4, hy + 1.3, 1.1, 0.8, 'rgba(225,100,80,0.55)'); ellipse(c, hx + 2.4, hy + 1.3, 1.1, 0.8, 'rgba(225,100,80,0.55)');
    if (L.freckles && !O.fem) { drawFreckles(c, hx, hy, sk, -1); drawFreckles(c, hx, hy, sk, 1); }
    // глаз не видно: густая тень под колпаком и торчащие из-под края брови
    ellipse(c, hx, hy + 0.8, 3.3, 0.75, 'rgba(48,22,8,0.55)');
    if (nob) { c.fillStyle = shade(bc, 0.1); c.fillRect(hx - 2.8, hy + 0.3, 2, 0.45); c.fillRect(hx + 0.8, hy + 0.3, 2, 0.45); }   // тонкие брови: тёмные широкие читались как очки
    else { c.fillStyle = shade(bc, -0.12); rrect(c, hx - 3.1, hy + 0.3, 2.7, 0.9, 0.4); c.fill(); rrect(c, hx + 0.4, hy + 0.3, 2.7, 0.9, 0.4); c.fill(); }
    if (L.brow && !nob) {   // кустистые брови: лохматые и торчат за край лица
      c.fillStyle = shade(bc, -0.05); rrect(c, hx - 3.9, hy + 0.1, 3.3, 1.3, 0.5); c.fill(); rrect(c, hx + 0.6, hy + 0.1, 3.3, 1.3, 0.5); c.fill();
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) line(c, hx + sd * (1 + k * 1.1), hy + 0.5, hx + sd * (1.3 + k * 1.1), hy - 0.6 - (k % 2) * 0.4, shade(bc, -0.05), 0.4);
    }
    drawNose(c, 'S', hx, hy, sk, nose);
    if (L.earring && !O.fem) drawEarring(c, hx + 5.6, hy - 0.4);
    if (fem) {
      if (!L.kid) for (const sd of [-1, 1]) { c.fillStyle = '#24140c'; c.fillRect(hx + sd * 1.7 - 0.8, hy + 1.2, 1.6, 0.5); c.fillRect(hx + sd * 2.6 - 0.25, hy + 0.8, 0.5, 0.5); }   // ресницы (у гномят глаз не видно, как у всех)
      ellipse(c, hx, hy + 3.6, 1.1, 0.55, '#c8402e'); ellipse(c, hx, hy + 3.4, 0.7, 0.2, '#e8705a');   // губы
      femHair(c, 'S', hx, hy, L, O);
    } else if (L.noBeard) ellipse(c, hx, hy + 3.5, 0.9, 0.4, '#b8503e');   // гномёнок: улыбка, бороды ещё нет
    else drawMoustache(c, 'S', hx, hy, bc, L.must);
  } else if (view === 'E') {
    drawEar(c, hx - 2.6, hy + 0.2, -1, sk);
    c.fillStyle = radgrad(c, hx, hy - 1, 0.4, R * 1.5, [[0, sk[0]], [0.7, sk[1]], [1, sk[2]]]);
    c.beginPath(); c.ellipse(hx, hy, R * 0.92, R, 0, 0, Math.PI * 2); c.fill();
    const bc = nob ? hc : drawBeard(c, 'E', hx, hy, L, type, bottom, r);
    if (O.skBeard >= 0 && !nob) skinBeard(c, O.skBeard, 'E', hx, hy);
    ellipse(c, hx + 1.9, hy + 1.1, 1.3, 1.1, sk[0]); ellipse(c, hx + 1.9, hy + 1.3, 1, 0.7, 'rgba(225,100,80,0.55)');
    if (L.freckles && !O.fem) drawFreckles(c, hx - 0.4, hy, sk, 1);
    ellipse(c, hx + 1.6, hy + 0.8, 2.2, 0.7, 'rgba(48,22,8,0.55)');
    if (nob) { c.fillStyle = shade(bc, 0.1); c.fillRect(hx + 1.3, hy + 0.3, 2.2, 0.45); }
    else { c.fillStyle = shade(bc, -0.12); rrect(c, hx + 1, hy + 0.3, 2.8, 0.9, 0.4); c.fill(); }
    if (L.brow && !nob) { c.fillStyle = shade(bc, -0.05); rrect(c, hx + 0.8, hy + 0.1, 3.6, 1.3, 0.5); c.fill(); for (let k = 0; k < 3; k++) line(c, hx + 1.4 + k * 1.1, hy + 0.5, hx + 1.8 + k * 1.1, hy - 0.6 - (k % 2) * 0.4, shade(bc, -0.05), 0.4); }
    drawNose(c, 'E', hx, hy, sk, nose);
    if (L.earring && !O.fem) drawEarring(c, hx - 4.6, hy - 0.6);
    if (fem) {
      if (!L.kid) { c.fillStyle = '#24140c'; c.fillRect(hx + 1.6, hy + 1.2, 1.6, 0.5); c.fillRect(hx + 3, hy + 0.8, 0.5, 0.5); }   // ресницы
      ellipse(c, hx + 3.3, hy + 3.5, 0.9, 0.5, '#c8402e');
      femHair(c, 'E', hx, hy, L, O);
    } else if (!L.noBeard) drawMoustache(c, 'E', hx, hy, bc, L.must);
    if (pipe) {
      line(c, hx + 3, hy + 2.4, hx + 6, hy + 3.2, '#4a2c14', 0.6);
      c.fillStyle = '#6a3c1c'; rrect(c, hx + 5.4, hy + 1.4, 1.7, 2.3, 0.4); c.fill();
      ellipse(c, hx + 6.25, hy + 1.5, 0.75, 0.3, 'rgba(255,140,40,0.9)');
    }
  } else {
    drawEar(c, hx - 3.4, hy + 0.2, -1, sk); drawEar(c, hx + 3.4, hy + 0.2, 1, sk);
    const bc = nob ? hc : type === 'enchanter' ? '#f0ece4' : (L.bcol || BEARDS[L.beard]);
    c.fillStyle = bc; c.beginPath(); c.ellipse(hx, hy + 0.4, R, R * 0.95, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = shade(bc, -0.25); c.lineWidth = 0.3;
    for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(hx + k * 1.2, hy - 1); c.lineTo(hx + k * 1.3, hy + 3.6); c.stroke(); }
    if (fem) femHair(c, 'N', hx, hy, L, O);
    else if (!L.noBeard) { ellipse(c, hx - 3.6, hy + 3, 1, 2, bc); ellipse(c, hx + 3.6, hy + 3, 1, 2, bc); }
  }
}

// ---------- Жесты ----------
// Локоть и кисть для жеста: E — сбоку (лицом вправо, плечо в x≈0.4), S/N — рука side=±1.
// Жесты: 4 такта туда-обратно между опорными позами 0 и 1. t — прежний счётчик (полный цикл = 2 единицы)
const GEST_FRAMES = 4;   // 4 такта туда-обратно = 3 различимые позы (0, середина, 1) — плавнее прежних двух, без раздувания кэша
function gestCyc(t) { return 10 + (Math.floor(t * GEST_FRAMES / 2) % GEST_FRAMES); }
function gestK(gf) { return gf < 10 ? gf : (1 - Math.cos((gf - 10) / GEST_FRAMES * Math.PI * 2)) / 2; }
function gestPts(g, f, side, shY, headY, view) {
  if (view === 'E') switch (g) {
    case 'wave':    return [[2.6, shY - 2.2], [3.4 + f * 1.2, headY - 3.4]];
    case 'fist':    return [[3.8, shY - 0.4], [4.6, headY - 1.6 - f * 1.4]];
    case 'scratch': return [[3.8, shY - 1.4], [2, headY - 3.6 + f * 0.5]];
    case 'stretch': return [[1.6, shY - 3.6], [1, headY - 7 - f * 0.6]];
    case 'yawn':    return [[3.2, shY + 1.6], [4.4, headY + 3.4]];
    case 'clap':    return [[3.4, shY + 1.4], [5.2 + f * 0.9, shY + 0.6]];
    case 'five':    return [[[1.6, shY - 3.4], [1.4, headY - 6.2]], [[3, shY - 3.6], [4.4, headY - 5]], [[3.8, shY - 2.6], [5.8, headY - 3.6]], [[2.4, shY - 0.4], [3.2, shY + 0.8]]][f & 3];   // вскинул назад · замах · хлопок · опустил
    // эпизод в трактире (inside.js, drawSlapScene): ухаживание гнома, замах и пощёчина трактирщицы, реакция
    case 'flirt':   return [[[3, shY + 1.2], [4.6, shY + 2.4]], [[3.4, shY + 0.4], [5.6, shY + 1]], [[3.6, shY], [6.4, shY - 0.2]], [[2.6, shY - 0.8], [4.6, headY + 2.4]], [[3.4, shY], [6.8, shY + 0.4]], [[3.6, shY - 0.4], [7.4, shY + 0.8]]][f % 6];
    case 'wslap':   return [[[1.6, shY + 2.6], [2, shY + 5]], [[-0.6, shY + 1.6], [-3, shY + 0.8]], [[-1.6, shY - 1], [-4.6, shY - 3.2]], [[2.2, shY - 2], [5.6, shY - 2.4]], [[3.8, shY - 2.6], [8, headY + 1]], [[3, shY - 0.6], [4.6, shY + 0.6]]][f % 6];
    case 'hips':    return [[3.4, shY + 2.6], [1.4, shY + 5.4]];
    case 'hat':     return [[2.6, shY - 3], [2.8, headY - 5.5]];                          // несёт колпак к макушке
    case 'cheek':   return [[3, shY + 1.2], [4.4, headY + 3.2 + (f & 1) * 0.4]];
    case 'panic':   return [[2.4, shY - 2.6], [3.4 + f * 1.4, headY - 4.6 + f * 1.2]];
    case 'eat':     return f >= 0.5 ? [[3.2, shY + 0.6], [4.6, headY + 3.4]] : [[3.4, shY + 2.4], [5.2, shY + 3.4]];
    case 'chest':   return [[2.4, shY + 2], [1.4, shY + 0.2 + f * 0.6]];                  // рука за пазухой
    case 'drink':   return [[3, shY + 2], [4.6, headY + 3.2 + f * 0.6]];                  // фляжка у рта
    default:        return [[3.4, shY], [6.4, shY - 0.6 - f * 0.3]];     // point
  }
  switch (g) {
    case 'wave':    return [[side * 6.2, shY - 1.6], [side * (6.4 + f * 1.2), headY - 3.4]];
    case 'fist':    return [[side * 6.4, shY + 0.4], [side * 5.8, headY - 1.6 - f * 1.4]];
    case 'scratch': return [[side * 6.6, shY - 1.4], [side * 4.4, headY - 3.4 + f * 0.5]];
    case 'stretch': return [[side * 5.8, shY - 3.2], [side * 4.2, headY - 7.4 - f * 0.6]];
    case 'yawn':    return [[side * 5, shY + 1.6], [side * 1.2, headY + 3.4]];
    case 'clap':    return [[side * 5.8, shY + 2.4], [side * (0.9 + f * 1.8), shY + 1.2]];     // хлопает перед грудью
    case 'six7':    { const k = side > 0 ? f : 1 - f; return [[side * 5.6, shY + 2.4 - k * 1.2], [side * 4.6, shY + 5 - k * 7.4]]; }     // мем «шесть-семь»: ладони вверх, руки качаются вразнобой
    case 'five':    return [[[side * 5.6, shY - 3.4], [side * 5.8, headY - 7]], [[side * 6, shY - 3], [side * 6.2, headY - 5.4]], [[side * 6.4, shY - 2.2], [side * 6.6, headY - 3.6]], [[side * 5.4, shY + 0.4], [side * 5.8, shY + 1.4]]][f & 3];
    case 'panic':   return [[side * 6.4, shY - 2], [side * (6.6 - f * 1.6), headY - 4.2 + f * 1.6]];   // машет руками над головой
    case 'eat':     return f >= 0.5 ? [[side * 5, shY + 0.4], [side * 1.4, headY + 4]] : [[side * 5.4, shY + 2.4], [side * 3.4, shY + 4.2]];   // ложка ко рту / в миску
    case 'chest':   return [[side * 4.6, shY + 2.4], [side * 1.8, shY + 0.4 + f * 0.6]];
    case 'drink':   return [[side * 4.6, shY + 1.4], [side * 1.6, headY + 3.6 + f * 0.6]];
    default:        return [[side * 5.8, shY + 0.4], [side * 7.4, shY - 0.6 - f * 0.3]];
  }
}

// Фляжка: серебристая, с пробкой; tilt — наклон к губам
function drawFlask(c, x, y, tilt) {
  c.save(); c.translate(x, y); c.rotate(-tilt);
  c.fillStyle = '#2a2e34'; c.fillRect(-2, -2.6, 4, 5.4);
  c.fillStyle = '#8a929c'; c.fillRect(-1.6, -2.2, 3.2, 4.6);
  c.fillStyle = '#dce4ec'; c.fillRect(-1.4, -1.8, 1, 3.8);
  c.fillStyle = '#6a4a28'; c.fillRect(-1, -4, 2, 1.6);
  c.restore();
}

// ---------- Оружие героя и 9 кадров боя ----------
// Оружие приходит строкой opt.wpn = 'основное|в левой руке|1' (1 — выхвачено, иначе в ножнах / за спиной;
// строку собирает heroWpnOf в herokit.js). Кадры боя — pose 'fight', только вид сбоку, frame — имя кадра:
// стойка, замах, удар, довод, парирование, получил удар, победа (2 кадра), выхватывание из ножен.
const FIGHT_FRAMES = ['ready', 'windup', 'strike', 'follow', 'parry', 'hurt', 'win0', 'win1', 'draw'];
const WPN_STYLE = { sword: 'blade', rsword: 'blade', mace: 'blade', cmace: 'blade', dagger: 'stab', rdagger: 'stab', bdagger: 'stab',
  axe2: 'heavy', staff: 'staff', sstaff: 'staff', wstaff: 'staff', bow: 'bow', cbow: 'bow', fists: 'fist' };
// где что носят, пока оружие не в руке: ножны на левом бедре или за спиной
const WPN_BACK = { axe2: 1, staff: 1, sstaff: 1, wstaff: 1, bow: 1, cbow: 1 };
// рука с оружием: [угол руки (0 — вверх, π/2 — вперёд, π — вниз), угол оружия, длина руки]
const FIGHT_ARM = {
  blade: { ready: [1.85, 0.4], windup: [-0.5, -0.95], strike: [1.5, 1.62], follow: [2.35, 2.5], parry: [1.3, 0.1], hurt: [2.6, 2.1], win0: [-0.08, -0.05], win1: [0.12, 0.2], draw: [3.35, 3.75] },
  stab:  { ready: [2.1, 1.3], windup: [2.75, 1.45, 3.2], strike: [1.6, 1.6, 4.8], follow: [1.85, 1.85], parry: [1.3, 0.3], hurt: [2.6, 2.2], win0: [-0.1, 0], win1: [0.15, 0.25], draw: [3.3, 3.6] },
  heavy: { ready: [1.8, 0.5], windup: [-0.6, -1.25], strike: [1.65, 1.9], follow: [2.45, 2.75], parry: [1.0, 0.02], hurt: [2.4, 1.3], win0: [-0.1, 0.08], win1: [0.1, 0.28], draw: [-0.75, -1.1] },
  staff: { ready: [1.9, 0.22], windup: [0.3, -0.32], strike: [1.45, 1.35], follow: [1.7, 1.0], parry: [1.3, 0.06], hurt: [2.6, 0.6], win0: [-0.05, 0], win1: [0.1, 0.12], draw: [-0.5, -0.6] },
  bow:   { ready: [1.95, 0.35], windup: [1.55, 0], strike: [1.55, 0], follow: [1.7, 0.15], parry: [1.4, 0.1], hurt: [2.5, 0.6], win0: [-0.15, -0.15], win1: [0.05, 0.05], draw: [-0.6, -0.5] },
  fist:  { ready: [1.9, 0, 3], windup: [2.3, 0, 2.2], strike: [1.6, 0, 4.9], follow: [1.75, 0, 4.2], parry: [1.0, 0, 3], hurt: [2.6, 0, 3.6], win0: [-0.05, 0, 4.4], win1: [0.2, 0, 4.4], draw: [2.3, 0, 2.6] },
};
// вторая рука: [x, y от плеча]; со щитом — щит держит перед собой, у лучника — тетива
const FIGHT_BACK = {
  free:   { ready: [1.8, 3.4], windup: [2.8, 2], strike: [-2.6, 2.8], follow: [-2.2, 3.4], parry: [1.6, 2.6], hurt: [-2.6, 1.2], win0: [-2.6, 2.2], win1: [-3, 0.8], draw: [-1.4, 5.4] },
  shield: { ready: [2.8, 3], windup: [3.4, 2], strike: [2.2, 3.6], follow: [1.8, 4], parry: [4.2, 0.4], hurt: [1.6, 4], win0: [2.6, 3.2], win1: [2.8, 2.6], draw: [2, 3.6] },
  bow:    { windup: [-0.8, -2.4], strike: [-3, 0.2] },
};
// наклон корпуса, присед (минус — подпрыгнул), шаг дальней и ближней ноги
const FIGHT_BODY = {
  ready: [0.06, 0.6, -0.4, 0.38], windup: [-0.1, 0.3, -0.45, 0.3], strike: [0.2, 0.8, -0.55, 0.62], follow: [0.26, 1.0, -0.6, 0.66],
  parry: [0.02, 1.0, -0.5, 0.45], hurt: [-0.28, 0.4, -0.2, 0.08], win0: [-0.06, 0, -0.18, 0.18], win1: [-0.1, -0.7, -0.12, 0.12], draw: [0.04, 0.4, -0.35, 0.3],
};

// Выхватывание и убирание: по 4 кадра d0..d3 (рука к рукояти → вытягивает → замах над собой → вскинул к стойке)
// и s0..s3 (то же в обратную сторону). Клинки и кинжалы идут из ножен на бедре с разворотом через спину,
// секира, посох и лук — из-за спины через плечо, кулаки (обмотки) прячутся к груди — «за пазуху».
const WPN_DRAW_T = 0.44;
(function () {
  const L = (a, b, t) => a + (b - a) * t, TS = [0, 0.3, 0.62, 0.88];
  for (const st in FIGHT_ARM) {
    const A = FIGHT_ARM[st], d = A.draw, r = A.ready, wrap = st === 'blade' || st === 'stab';
    const mk = t => [L(d[0], r[0], t), L(d[1], wrap ? r[1] + 2 * Math.PI : r[1], t), L(d[2] ?? 4.2, r[2] ?? 4.2, t)];
    TS.forEach((t, i) => { A['d' + i] = mk(t); A['s' + (3 - i)] = mk(t); });
  }
  const lerpArr = (a, b, t) => a.map((v, i) => L(v, b[i], t));
  for (const T of [FIGHT_BODY, FIGHT_BACK.free, FIGHT_BACK.shield]) {
    TS.forEach((t, i) => { T['d' + i] = T['s' + (3 - i)] = lerpArr(T.draw, T.ready, t); });
  }
})();
// Каст и лечение: 6 кадров c0..c5 (стойка → вскинул оружие → пик силы → опускает), стандарт «каст 6»
const CAST_FRAMES = 6;
(function () {
  const L = (a, b, t) => a + (b - a) * t;
  const P = [[0.3, 0], [0.7, 0], [1, 0], [1, 0.6], [0.8, 0], [0.4, 0]];   // [доля ready→win0, доля win0→win1]
  const mix = (r, w0, w1, [a, b], def) => r.map((v, n) => L(L(v, w0[n] ?? def, a), w1[n] ?? def, b));
  for (const st in FIGHT_ARM) { const A = FIGHT_ARM[st]; P.forEach((q, i) => { A['c' + i] = mix([A.ready[0], A.ready[1], A.ready[2] ?? 4.2], A.win0, A.win1, q, 4.2); }); }
  for (const T of [FIGHT_BODY, FIGHT_BACK.free, FIGHT_BACK.shield]) P.forEach((q, i) => { T['c' + i] = mix(T.ready, T.win0, T.win1, q, 0); });
})();
const isCastF = f => typeof f === 'string' && f.length === 2 && f[0] === 'c';
// ---------- Драка и отлёт (js/world/brawl.js) ----------
// Кадры пьяной драки поверх тех же таблиц: пинок (kwind/kick/kfollow), бутыль (bwind/bhit/bfollow — после удара остаётся «розочка»),
// шатание (sg0/sg1), падение (fl0 — на землю его кладёт поворот в render.js), вставание (up0/up1), отлёт героя (fy0/fy1/fy2) и сидение (sit).
// Кулачные кадры берутся готовые: ready, windup, strike, follow, parry, hurt, win0, win1.
Object.assign(FIGHT_BODY, {
  kwind: [-0.14, 0.6, -0.5, -0.55], kick: [-0.34, 0.15, -0.35, 1.5], kfollow: [-0.12, 0.55, -0.4, 0.95],
  bwind: [-0.14, 0.35, -0.45, 0.3], bhit: [0.24, 0.85, -0.55, 0.62], bfollow: [0.3, 1.0, -0.6, 0.66],
  sg0: [-0.4, 0.5, -0.65, 0.5], sg1: [0.3, 0.7, 0.55, -0.55], fl0: [-0.3, 0.2, 0.35, 0.6],
  up0: [0.32, 1.6, -0.35, 0.7], up1: [0.22, 0.9, -0.3, 0.35],
  fy0: [-0.35, 0, 0.7, 0.45], fy1: [-0.1, -0.2, 1.0, -0.8], fy2: [0.1, 0.1, 0.5, 0.75], sit: [0.08, 1.9, 1.4, 1.25],
});
Object.assign(FIGHT_ARM.fist, {
  kwind: [2.5, 0, 3], kick: [2.8, 0, 3.4], kfollow: [2.2, 0, 3],
  bwind: [-0.45, 0, 3.6], bhit: [1.75, 0, 4.9], bfollow: [2.35, 0, 4.2],
  sg0: [-0.5, 0, 3.4], sg1: [2.9, 0, 3.1], fl0: [-0.9, 0, 3.6], up0: [2.7, 0, 3.2], up1: [2.2, 0, 3],
  fy0: [-0.8, 0, 3.8], fy1: [0.15, 0, 4.2], fy2: [2.9, 0, 3.4], sit: [0.5, 0, 2.4],
});
Object.assign(FIGHT_BACK.free, {
  kwind: [-2.2, 2.6], kick: [-2.8, 1.2], kfollow: [-1.8, 3], bwind: [2.2, 2.4], bhit: [-2.4, 2.6], bfollow: [-2, 3.2],
  sg0: [-2.8, 0.6], sg1: [2.4, 0.5], fl0: [-2.4, -0.6], up0: [1.4, 4.6], up1: [1.6, 3.4],
  fy0: [-3, -0.4], fy1: [-3, 0.8], fy2: [-2.4, 3.6], sit: [1.2, 4],
});
// герой и рекруты держат оружие: у новых кадров те же углы, что у «получил удар»
for (const st in FIGHT_ARM) for (const n in FIGHT_BODY) if (!FIGHT_ARM[st][n]) FIGHT_ARM[st][n] = FIGHT_ARM[st].hurt;
for (const k of ['free', 'shield']) for (const n in FIGHT_BODY) if (!FIGHT_BACK[k][n]) FIGHT_BACK[k][n] = FIGHT_BACK[k].hurt;
// бутыль в кулаке: [угол (0 — вверх, π/2 — вперёд), разбита ли]
const BOTTLE_POSE = { bwind: [-0.55, 0], bhit: [1.95, 0], bfollow: [2.6, 1] };
function drawBottle(c, x, y, ang, broken) {
  const dx = Math.sin(ang), dy = -Math.cos(ang), nx = -dy, ny = dx;
  const P = t => [x + dx * t, y + dy * t];
  const OL = '#12200f';
  if (broken) {
    // «розочка»: горлышко и зубья битого стекла
    const a = P(0), b = P(2.3);
    line(c, a[0], a[1], b[0], b[1], OL, 2.1); line(c, a[0], a[1], b[0], b[1], '#3f8a4a', 1.5);
    poly(c, [[-1.3, 2.3], [-0.7, 3.7], [-0.1, 2.5], [0.5, 3.9], [1.3, 2.4]].map(([o, t]) => [P(t)[0] + nx * o, P(t)[1] + ny * o]), '#b8f0c0', OL, 0.3);
    return;
  }
  const a = P(-0.8), m = P(3.8), n1 = P(4.2), n2 = P(7);
  line(c, a[0], a[1], m[0], m[1], OL, 3.3); line(c, a[0], a[1], m[0], m[1], '#2f8a3e', 2.6);
  line(c, n1[0], n1[1], n2[0], n2[1], OL, 2); line(c, n1[0], n1[1], n2[0], n2[1], '#48a055', 1.3);
  const h1 = P(0.2), h2 = P(3);
  line(c, h1[0] + nx * 0.5, h1[1] + ny * 0.5, h2[0] + nx * 0.5, h2[1] + ny * 0.5, 'rgba(235,255,230,0.75)', 0.4);   // блик
  const lb = P(1.5); ellipse(c, lb[0], lb[1], 1.1, 1.1, '#e8d8a0');                                                // этикетка
}

// кадр выхватывания / убирания по времени с начала (null — анимация кончилась)
function wpnAnimFrame(k, el) { return el >= 0 && el < WPN_DRAW_T ? k + Math.min(3, Math.floor(el / WPN_DRAW_T * 4)) : null; }

function wpnParse(s) { const [m, o, out] = String(s).split('|'); return { m: m || '', o: o || '', out: out === '1' }; }

// Кадр боя по анимации героя (u.anim — f*, u.hfx — короткий удар/парирование поверх всего); null — не бой
function fightFrameOf(u, moving) {
  // герой, рекруты гильдий (u.rec, в общей деревне — u.gx) и главы гильдий
  if (u.type !== 'hero' && !(u.hero && u.hero.owner) && !u.rec && !u.gx && !u.gm) return null;
  if (moving) { u._ffT = 0; return null; }
  const fr = fightFrameRaw(u);
  if (fr) { u._ffT = Game.time; return fr; }
  // между двумя боевыми действиями бывает такт без анимации — держим стойку, а не разворачиваемся к зрителю
  if (u._ffT && Game.time - u._ffT < 0.25 && !u.anim) return 'ready';
  return null;
}
function fightFrameRaw(u) {
  if (u.hfx && u.hfx.t > Game.time) {
    const h = u.hfx;
    if (h.k !== 'cast') return h.k;
    return 'c' + Math.min(CAST_FRAMES - 1, Math.max(0, Math.floor((1 - (h.t - Game.time) / h.d) * CAST_FRAMES)));
  }
  const an = u.anim;
  if (!an || an[0] !== 'f' || !FIGHT_ANIM_SET.has(an)) return null;
  const a = u.action, p = a && a.T ? 1 - Math.max(0, a.t) / a.T : 1;
  if (an === 'fatk') return p < 0.22 ? 'ready' : p < 0.78 ? 'windup' : 'strike';
  if (an === 'ffollow') return p < 0.55 ? 'follow' : 'ready';
  if (an === 'fwin') return Math.floor(p * 6) % 2 ? 'win1' : 'win0';
  if (an === 'fdraw') return wpnAnimFrame('d', p * WPN_DRAW_T) || 'ready';
  if (an === 'fready') return 'ready';
  if (an === 'fparry') return 'parry';
  if (an === 'fhurt') return 'hurt';
  return null;
}
const FIGHT_ANIM_SET = new Set(['fatk', 'ffollow', 'fwin', 'fdraw', 'fready', 'fparry', 'fhurt']);

// Клинки и древки: от точки хвата (x, y) по направлению (dx, dy). part 'hilt' — только рукоять (клинок ещё в ножнах)
function drawWeapon(c, k, x, y, dx, dy, part) {
  const P = t => [x + dx * t, y + dy * t];
  const nx = -dy, ny = dx;
  // тёмный контур под каждой деталью: оружие читается и на сером доспехе, и на траве
  const OL = '#1e160e';
  const seg = (t0, t1, col, w) => { const a = P(t0), b = P(t1); line(c, a[0], a[1], b[0], b[1], OL, w + 0.55); line(c, a[0], a[1], b[0], b[1], col, w); };
  const hl = (t0, t1, col, w) => { const a = P(t0), b = P(t1); line(c, a[0], a[1], b[0], b[1], col, w); };   // блики и обмотки — без контура
  const side = (t, o) => { const p = P(t); return [p[0] + nx * o, p[1] + ny * o]; };
  c.lineCap = 'round';
  const rust = k[0] === 'r' || k === 'bdagger';
  switch (k) {
    case 'sword': case 'rsword': {
      seg(-1.5, 0.6, '#4a2c18', 1); hl(-1.2, 0.2, '#6e4428', 0.5);                     // рукоять с обмоткой
      const pm = P(-1.7); ellipse(c, pm[0], pm[1], 0.65, 0.65, rust ? '#7a6248' : '#c89226');
      const g = P(0.75); line(c, g[0] - nx * 2.4, g[1] - ny * 2.4, g[0] + nx * 2.4, g[1] + ny * 2.4, OL, 1.6); line(c, g[0] - nx * 2.3, g[1] - ny * 2.3, g[0] + nx * 2.3, g[1] + ny * 2.3, rust ? '#6a5236' : '#d8a634', 1);
      if (part === 'hilt') break;
      poly(c, [side(1, -1.3), side(8.2, -1.15), P(10), side(8.2, 1.15), side(1, 1.3)], rust ? '#a89a82' : '#c4cad4', OL, 0.45);
      poly(c, [side(1.1, 0), side(8.8, 0), side(8.2, 1.0), side(1, 1.2)], rust ? '#8a7c66' : '#9aa2b0');   // тень со второй стороны клинка
      hl(1.4, 8.4, rust ? '#d2c6b0' : '#f8fafc', 0.45);                                         // блик по долу
      if (rust) {
        for (const [t, o] of [[2.2, 0.3], [3.5, -0.35], [5.1, 0.25], [6.2, -0.2]]) { const r = side(t, o); ellipse(c, r[0], r[1], 0.5, 0.42, t > 4 ? '#8a4e2a' : '#a8642e'); }
        poly(c, [side(4.1, 0.98), side(4.4, 0.35), side(4.7, 0.98)], '#3a3026');                // зазубрина
      }
      break;
    }
    case 'mace': case 'cmace': {
      seg(-1.2, 4.4, '#6e4428', 1); seg(-0.8, 0.4, '#3a2416', 1.1);
      const h = P(5.4);
      for (let a = 0; a < 6; a++) { const q = a * Math.PI / 3; line(c, h[0], h[1], h[0] + Math.cos(q) * 2.1, h[1] + Math.sin(q) * 2.1, '#5a5e66', 0.6); }
      ellipse(c, h[0], h[1], 1.55, 1.55, '#8a8e96'); ellipse(c, h[0] - 0.4, h[1] - 0.5, 0.55, 0.5, '#c8ccd4');
      if (k === 'cmace') line(c, h[0] - 1, h[1] - 0.8, h[0] + 0.9, h[1] + 1, '#2a2a30', 0.35);   // трещина
      break;
    }
    case 'dagger': case 'rdagger': case 'bdagger': {
      seg(-1.4, 0.4, '#3a2416', 1);
      const g = P(0.55); line(c, g[0] - nx * 1.4, g[1] - ny * 1.4, g[0] + nx * 1.4, g[1] + ny * 1.4, OL, 1.2); line(c, g[0] - nx * 1.3, g[1] - ny * 1.3, g[0] + nx * 1.3, g[1] + ny * 1.3, rust ? '#8a6a46' : '#a8acb4', 0.65);
      if (part === 'hilt') break;
      if (k === 'bdagger') {
        // сломан: обломок с рваным краем
        poly(c, [side(0.7, -0.75), side(2.6, -0.65), side(3.0, -0.15), side(2.6, 0.2), side(3.1, 0.65), side(0.7, 0.75)], '#a89c88', OL, 0.4);
        hl(0.8, 2.5, '#d2c6b0', 0.35);
      } else {
        poly(c, [side(0.7, -0.75), side(4.4, -0.55), P(5.5), side(4.4, 0.55), side(0.7, 0.75)], rust ? '#b0a28a' : '#d8dce4', OL, 0.4);
        hl(0.8, 4.6, rust ? '#dccfb8' : '#f6f8fa', 0.35);
        if (rust) for (const [t, o] of [[2, 0.3], [3.4, -0.25]]) { const r = side(t, o); ellipse(c, r[0], r[1], 0.45, 0.38, '#a8642e'); }
      }
      break;
    }
    case 'axe2': {
      seg(-3.6, 7.6, '#5a361c', 1); hl(-3.4, 7.4, '#8a5e36', 0.35); hl(-0.6, 0.8, '#2a1a10', 1.1);   // длинное топорище, обмотка
      // ржавое двустороннее полотно с выщербиной
      poly(c, [side(4.5, 0.4), side(3.9, 3.4), side(4.9, 4.9), side(7.1, 5.1), side(8.3, 3.7), side(7.7, 0.4)], '#9a8e7c', OL, 0.45);
      poly(c, [side(5.1, -0.4), side(4.8, -2.1), side(7.2, -2.2), side(7.4, -0.4)], '#867a6c', OL, 0.45);
      line(c, ...side(4.6, 4.7), ...side(7.7, 4.1), '#cfc4b2', 0.5);                         // лезвие
      for (const [t, o] of [[5.4, 2.1], [6.8, 3.2], [6.3, 1.2]]) { const r = side(t, o); ellipse(c, r[0], r[1], 0.75, 0.6, '#9a5a2e'); }
      poly(c, [side(5.9, 5.15), side(6.3, 3.9), side(6.8, 5.15)], '#1e1a16');                   // выщербина
      break;
    }
    case 'staff': case 'sstaff': case 'wstaff': {
      const wood = k === 'wstaff' ? '#6a5a46' : '#6e4428';
      seg(-4.6, 6.4, wood, 0.8);
      if (k === 'wstaff') {
        // увядший: кривой, с сучками, на конце засохший завиток и бурый лист
        for (const t of [-2, 1.4, 4.2]) { const r = side(t, 0.45); ellipse(c, r[0], r[1], 0.45, 0.4, '#4a3e30'); }
        const top = P(6.4), q = side(7.6, 1.2);
        c.strokeStyle = wood; c.lineWidth = 0.75; c.beginPath(); c.moveTo(top[0], top[1]); c.quadraticCurveTo(...P(7.8), q[0], q[1]); c.stroke();
        const lf = side(6.6, -1);
        ellipse(c, lf[0], lf[1], 0.9, 0.55, '#a08a4a'); line(c, top[0], top[1], lf[0], lf[1], '#6a5a2e', 0.25);
      } else if (k === 'sstaff') {
        // искрящий: на конце треснутый кристалл и искры
        const t0 = P(6.6), t1 = P(8.6);
        poly(c, [side(6.4, -0.9), t1, side(6.4, 0.9), P(5.9)], '#7ad0f0', '#2a5a7a', 0.3);
        poly(c, [side(6.6, -0.35), P(8.1), side(6.8, 0.3)], '#e8fbff');
        for (const [a, r] of [[0.6, 2.2], [2.4, 1.9], [4.1, 2.4], [5.3, 1.6]]) ellipse(c, t0[0] + Math.cos(a) * r, t0[1] + Math.sin(a) * r, 0.35, 0.35, a > 3 ? '#fff6a0' : '#bff4ff');
      } else {
        const t0 = P(6.9); ellipse(c, t0[0], t0[1], 1.2, 1.2, '#5a7ae0'); ellipse(c, t0[0] - 0.35, t0[1] - 0.4, 0.45, 0.4, '#d8e4ff');
      }
      break;
    }
  }
}

// Лук: в руке (x, y), наклон tilt (0 — стоит вертикально), pull — точка, куда оттянута тетива
function drawBow(c, k, x, y, tilt, pull) {
  const ux = Math.sin(tilt), uy = -Math.cos(tilt), fx = Math.cos(tilt), fy = Math.sin(tilt);
  const crooked = k === 'cbow';
  const la = 5.6, lb = crooked ? 4.6 : 5.6;                    // у кривого лука нижнее плечо короче
  const a = [x + ux * la - fx * 1.6, y + uy * la - fy * 1.6], b = [x - ux * lb - fx * (crooked ? 1 : 1.6), y - uy * lb - fy * (crooked ? 1 : 1.6)];
  const cx = 2 * (x + fx * 0.6) - (a[0] + b[0]) / 2, cy = 2 * (y + fy * 0.6) - (a[1] + b[1]) / 2;
  c.lineCap = 'round';
  for (const [col, w] of [['#1e160e', 1.5], [crooked ? '#b88a4e' : '#c89058', 0.95]]) {
    c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(cx + (crooked ? ux * 0.8 : 0), cy + (crooked ? uy * 0.8 : 0), b[0], b[1]); c.stroke();
  }
  line(c, x - ux * 0.8, y - uy * 0.8, x + ux * 0.8, y + uy * 0.8, '#2a1a10', 1.2);   // обмотка рукояти
  c.strokeStyle = '#f6eedc'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(a[0], a[1]);
  if (pull) c.lineTo(pull[0], pull[1]);
  c.lineTo(b[0], b[1]); c.stroke();
  if (pull) {                                                      // стрела на тетиве
    line(c, pull[0], pull[1], x + fx * 2.6, y + fy * 2.6, '#8a5a30', 0.55);
    poly(c, [[x + fx * 2.6 - ux * 0.6, y + fy * 2.6 - uy * 0.6], [x + fx * 3.8, y + fy * 3.8], [x + fx * 2.6 + ux * 0.6, y + fy * 2.6 + uy * 0.6]], '#cec6ba');
    ellipse(c, pull[0] + fx * 0.6, pull[1] + fy * 0.6, 0.6, 0.45, '#e04a3a');
  }
}

// Деревянный щит: rx/ry — сбоку узкий, спереди круглый
function drawShield(c, x, y, rx, ry) {
  ellipse(c, x, y, rx + 0.45, ry + 0.45, '#3a2a1a');
  c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.clip();
  c.fillStyle = lingrad(c, x - rx, 0, x + rx, 0, [[0, '#a8743e'], [0.5, '#8a5a30'], [1, '#5e3c20']]); c.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  for (let k = -2; k <= 2; k++) line(c, x - rx, y + k * ry * 0.38, x + rx, y + k * ry * 0.38, '#5a3a1e', 0.25);   // доски
  line(c, x - rx * 0.2, y - ry * 0.7, x + rx * 0.3, y - ry * 0.1, '#3a2414', 0.3);                                 // трещина
  c.restore();
  ellipse(c, x, y, Math.min(1.1, rx * 0.5), 1.1, '#7a7e86'); ellipse(c, x - 0.25, y - 0.35, 0.4, 0.35, '#c8ccd4');   // умбон
}

// Ножны с мечом или кинжалом на бедре: (x, y) — устье, (dx, dy) — вниз по ножнам; full — клинок внутри (рукоять торчит)
function drawSheath(c, k, x, y, dx, dy, full) {
  const len = WPN_STYLE[k] === 'stab' ? 3.8 : 6.6;
  line(c, x, y, x + dx * len, y + dy * len, '#2a180c', 1.5);
  line(c, x, y, x + dx * len, y + dy * len, '#5a3a20', 1.05);
  ellipse(c, x + dx * len, y + dy * len, 0.55, 0.55, '#8a8e92');                     // наконечник
  line(c, x + dx * 0.6, y + dy * 0.6, x + dx * 1.1, y + dy * 1.1, '#c8a050', 1.2);   // обойма
  if (full) drawWeapon(c, k, x, y, -dx, -dy, 'hilt');
}

// За спиной: секира, посох, лук или щит (x, y — середина спины, dir 1 — рукоять внизу слева)
function drawOnBack(c, k, x, y, view) {
  const e = view === 'E';
  if (k === 'wshield') { drawShield(c, x, y, e ? 1.6 : 3.1, 3.6); return; }
  const ang = e ? -0.38 : (view === 'S' ? 0.42 : -0.82);
  const dx = Math.sin(ang), dy = -Math.cos(ang);
  if (k === 'bow' || k === 'cbow') { drawBow(c, k, x - dx * 0.5, y - dy * 0.5, ang + (e ? 0.2 : 0), null); return; }
  drawWeapon(c, k, x - dx * 2.6, y - dy * 2.6, dx, dy);
}

// ---------- Фигура ----------
// pose: idle | walk | work | duck | smoke | tame | fight; frame: 0..7 для шага, {anim, f} для работы, имя кадра для боя
// opt.gait: '' — вразвалочку, 'drunk' — шатается, 'tired' — голодный плетётся;
// opt.gest: wave | fist | scratch | stretch | yawn | clap | point | six7, opt.gf — кадр жеста: 0/1 (опорные позы) или gestCyc() — 4 такта (3 позы).

// Юбка официантки: колоколом до колен, красная с подолом-фестоном и белым фартуком (вид спереди/сзади)
function femSkirt(c, hipY, front, sw, col = '#8e3a2c', apron = '#fbf7ec', gold = true) {
  const top = hipY - 0.2, hem = -1.6, w = 7.4 + Math.abs(sw) * 0.5;
  c.beginPath();
  c.moveTo(-4.7, top); c.lineTo(4.7, top);
  c.quadraticCurveTo(w - 0.4, (top + hem) / 2, w, hem);
  for (let k = 0; k < 6; k++) c.quadraticCurveTo(w - (k + 0.5) * w / 3, hem + 1.1, w - (k + 1) * w / 3, hem);
  c.quadraticCurveTo(-w + 0.4, (top + hem) / 2, -4.7, top);
  c.closePath();
  c.fillStyle = lingrad(c, -w, 0, w, 0, [[0, shade(col, 0.25)], [0.5, col], [1, shade(col, -0.4)]]);
  c.fill();
  c.strokeStyle = shade(col, -0.35); c.lineWidth = 0.35;
  for (const x of [-4.2, -1.4, 1.4, 4.2]) { c.beginPath(); c.moveTo(x * 0.55, top + 0.6); c.lineTo(x * 1.55, hem); c.stroke(); }
  c.fillStyle = gold ? '#e8c860' : shade(col, 0.35); c.fillRect(-w + 0.6, hem - 0.3, 2 * w - 1.2, 0.5);        // тесьма по подолу
  if (!apron) return;
  if (front) {
    c.fillStyle = lingrad(c, 0, top, 0, hem, [[0, apron], [1, shade(apron, -0.15)]]);
    c.beginPath(); c.moveTo(-2.7, top + 0.4); c.lineTo(2.7, top + 0.4); c.lineTo(3.6, hem - 0.5); c.lineTo(-3.6, hem - 0.5); c.closePath(); c.fill();
    c.fillStyle = 'rgba(120,100,80,0.35)'; c.fillRect(-1.6, top + 2.2, 3.2, 0.4);
  } else { ellipse(c, 0, top + 0.6, 1.3, 0.8, apron); poly(c, [[-0.3, top + 0.8], [-1.8, top + 3], [-0.8, top + 3.2]], apron); poly(c, [[0.3, top + 0.8], [1.8, top + 3], [0.8, top + 3.2]], shade(apron, -0.06)); }   // бант фартука
}

// Грудь и декольте под зелёным лифом (вид спереди)
function femBust(c, shY, skin) {
  poly(c, [[-3.1, shY - 0.6], [3.1, shY - 0.6], [1.4, shY + 2.4], [0, shY + 3.6], [-1.4, shY + 2.4]], skin[0]);           // вырез
  ellipse(c, -1.9, shY + 2.5, 2.25, 2.1, skin[0]); ellipse(c, 1.9, shY + 2.5, 2.25, 2.1, skin[0]);                          // сами груди
  c.fillStyle = '#3f7a46'; c.beginPath(); c.ellipse(-1.9, shY + 3.5, 2.35, 1.5, 0, 0, Math.PI); c.fill(); c.beginPath(); c.ellipse(1.9, shY + 3.5, 2.35, 1.5, 0, 0, Math.PI); c.fill();   // лиф снизу
  ellipse(c, -2.1, shY + 1.8, 0.9, 0.6, 'rgba(255,240,225,0.7)'); ellipse(c, 1.7, shY + 1.8, 0.9, 0.6, 'rgba(255,240,225,0.6)');
  c.strokeStyle = skin[2]; c.lineWidth = 0.45; c.beginPath(); c.moveTo(0, shY + 1.3); c.lineTo(0, shY + 3.5); c.stroke();     // ложбинка
  c.strokeStyle = '#e8c860'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-3.4, shY + 0.2); c.quadraticCurveTo(-2.6, shY + 3, -0.4, shY + 3.9); c.moveTo(3.4, shY + 0.2); c.quadraticCurveTo(2.6, shY + 3, 0.4, shY + 3.9); c.stroke();   // шнуровка по краю выреза
  ellipse(c, 0, shY - 0.4, 2.2, 0.8, skin[0]);
}

// Стандарт кадров: покой 12 (дыхание), ходьба 12, работа 12 (замах → удар → возврат), бой 9
const IDLE_FRAMES = 12, WORK_FRAMES = 12, WALK_FRAMES = 12;
// плавный вдох-выдох за 12 тактов; подъём груди кратен пикселю арта (1/3 мира), поэтому одинаковые по высоте такты
// делят один спрайт (IDLE_POSE — какой показывать на такте), иначе кэш гномов растёт вдвое
const IDLE_BREATH = Array.from({ length: IDLE_FRAMES }, (_, i) => Math.round((1 - Math.cos(i / IDLE_FRAMES * Math.PI * 2)) / 4 * 6) / 6);
const IDLE_POSE = IDLE_BREATH.map((b, i) => IDLE_BREATH.indexOf(b));
// 12 кадров удара в порядке времени: 0 инструмент внизу → 1–5 подъём → 6 над плечом → 7 отведён назад → 8 разгон → 9 удар → 10 нижняя точка → 11 возврат
const SWING_A = [1.2, 1.05, 0.9, 0.75, 0.6, 0.35, 0.05, -0.14, 0.7, 1.5, 1.8, 1.6];
const SWING_SICKLE = [2.06, 1.97, 1.88, 1.78, 1.68, 1.5, 1.3, 1.17, 1.7, 2.26, 2.45, 2.3];
const SWING_DIP = [0.1, 0.08, 0.05, 0, -0.1, -0.2, -0.3, -0.4, -0.05, 0.3, 0.5, 0.35];
// бросок (детские игры, kidsplay.js), 9 кадров: рука вперёд → вверх → назад → замах → удержание → разгон → отпускание (6) → проводка → возврат
const TOSS_A = [0.9, 0.1, -0.7, -1.2, -1.3, -0.3, 1.2, 2.0, 1.4];
const TOSS_DIP = [0, -0.1, -0.2, -0.3, -0.3, 0, 0.3, 0.6, 0.2];
const PAT_A = [2.0, 2.25, 2.5, 2.7, 2.5, 2.25, 2.0, 1.8];     // хлопает ладонью вниз-вперёд, 8 кадров
const swingDip = fr => fr.anim === 'toss' ? TOSS_DIP[fr.f] : fr.anim === 'pat' ? 1.4 : SWING_DIP[fr.f];

function drawPerson(c, type, L, view, pose, frame, carry, injury, r, opt = {}) {
  const O = OUTFIT[type] || OUTFIT.serf;
  const shirt = O.robe ? (O.robeCol || '#2e5a26') : (O.coat || L.green), pants = O.pants;
  const gait = opt.gait || '', gest = carry ? '' : (opt.gest || ''), gf = gest === 'five' ? (opt.gf || 0) : gestK(opt.gf || 0);
  const ph = pose === 'walk' ? frame / WALK_FRAMES * Math.PI * 2 : 0;
  const sw = Math.sin(ph);
  const limp = injury === 'leg' && pose === 'walk';
  const bob = pose === 'walk' ? -Math.abs(Math.cos(ph)) * (limp ? 1.2 : gait === 'tired' ? 0.3 : 0.7) + 0.3 : 0;
  const courier = !!O.frame;
  const duck = pose === 'duck' || pose === 'tame';
  // оружие героя: в бою — кадр из FIGHT_*, на ходу и стоя — выхвачено (стойка) или в ножнах/за спиной
  // в бою без оружия — на кулаках
  const W = opt.wpn ? wpnParse(opt.wpn) : pose === 'fight' ? { m: '', o: '', out: true } : null;
  const fight = pose === 'fight' ? (FIGHT_BODY[frame] ? frame : 'ready') : null;
  const wst = W ? (WPN_STYLE[W.m] || 'fist') : 'fist';
  const armed = !!W && !carry && (fight || (W.out && (pose === 'walk' || pose === 'idle')));
  // дыхание в покое: 6 кадров, грудь и голова чуть поднимаются на вдохе; в работе корпус подаётся в удар
  const breath = pose === 'idle' && typeof frame === 'number' ? IDLE_BREATH[frame % IDLE_FRAMES] : 0;
  const crouch = (duck ? 1.8 : fight ? FIGHT_BODY[fight][1] : 0) - breath + (pose === 'work' ? swingDip(frame) : 0);
  let lean = 0;
  if (fight) lean = FIGHT_BODY[fight][0];
  if (pose === 'walk') lean = carry ? 0.16 : 0.05;
  if (pose === 'walk' && gait === 'tired') lean += 0.16;
  if (pose === 'walk' && gait === 'drunk') lean += Math.cos(ph) * 0.1;
  if (limp) lean += sw > 0 ? 0.12 : -0.02;
  if (pose === 'work' && (frame.anim === 'reap' || frame.anim === 'dig')) lean = 0.28;
  if (pose === 'work' && frame.anim === 'pat') lean = 0.42;
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
  const beardBottom = L.beardStyle === 4 ? shY + 0.8 : L.beardLen === 2 ? hipY + 0.2 : shY + 3.4;
  const lvl = opt.lvl || 1;        // нашивки за выслугу на колпаке
  const carryN = carry ? Math.max(1, opt.carryN || 1) : 0;
  const upper = fn => { c.save(); c.translate(0, hipY); c.rotate(lean); c.translate(0, -hipY); fn(); c.restore(); };
  const skin = SKINS[L.skin];
  // гномка: юбка цвета куртки профессии, фартук — если он у профессии есть; у официантки свой наряд
  const capCol = O.cap === 'serf' ? L.serfCap : typeof O.cap === 'string' && O.cap[0] === '#' ? O.cap : null;
  const fem = O.fem || L.fem, skirtCol = O.fem ? '#8e3a2c' : capCol ? shade(capCol, -0.28) : shade(shirt, -0.12), skirtApron = O.fem ? '#fbf7ec' : O.apron || null;
  // гномёнок: голова крупнее тела (сам спрайт уменьшен в family.js)
  const head = (hx, fn) => { if (!L.kid) { fn(); return; } c.save(); c.translate(hx, headY + 3); c.scale(1.2, 1.2); c.translate(-hx, -(headY + 3)); fn(); c.restore(); };

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
      let bend = pose === 'walk' && !stiff ? Math.max(0, Math.sin(ph + (l.far ? Math.PI : 0) + Math.PI / 2)) * 0.7 : 0.05;
      let th = stiff ? l.th * 0.5 : l.th;
      if (fight) { th = FIGHT_BODY[fight][l.far ? 2 : 3]; bend = l.far ? 0.08 : 0.32; }   // боевая стойка: ноги врозь, ближняя чуть согнута
      else if (armed && pose === 'idle') { th = l.far ? -0.3 : 0.3; bend = 0.15; }
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
    // замах: 0 — инструмент поднят над плечом, 3 — удар вперёд-вниз; дуга ~100°, без прокрутки
    const ang = tool ? (tool === 'toss' ? TOSS_A : tool === 'pat' ? PAT_A : tool === 'sickle' || tool === 'spade' ? SWING_SICKLE : SWING_A)[frame.f] : 0;
    const armA = pose === 'walk' ? -sw * 0.55 : duck ? -0.5 : 0;
    const sling = injury === 'arm';
    // руки с оружием: кадр боя, а на ходу и стоя с выхваченным оружием — «стойка»
    const ff = fight || 'ready';
    let wA = null;
    if (armed) {
      const [A, Wd, rr = 4.2] = FIGHT_ARM[wst][ff];
      const hx = 0.4 + Math.sin(A) * rr, hy = shY + 0.4 - Math.cos(A) * rr;
      // на ходу клинок покачивается вместе с шагом, рука подпрыгивает: меч несут, а не приклеили
      const wk = !fight && pose === 'walk' && (wst === 'blade' || wst === 'stab') ? sw : 0;
      wA = { hx: hx + wk * 0.3, hy: hy + wk * 0.5, dx: Math.sin(Wd + wk * 0.16), dy: -Math.cos(Wd + wk * 0.16), Wd };
      const two = (wst === 'heavy' || wst === 'staff') && ff !== 'draw' && ff !== 'd0' && ff !== 's3' && !(wst === 'staff' && (ff === 'win0' || ff === 'win1' || isCastF(ff)));
      let bx, by;
      if (two) { bx = hx - wA.dx * 2.4; by = hy - wA.dy * 2.4; }          // двуручное: вторая рука ниже на древке
      else if (wst === 'bow') { const q = FIGHT_BACK.bow[ff]; if (q) { bx = -0.4 + q[0]; by = shY + 0.4 + q[1]; } else { bx = hx - 0.9; by = hy + 0.3; } }
      else if (!fight && pose === 'walk' && W.o !== 'wshield') { bx = Math.sin(-armA) * 2.8 + 0.8; by = shY + Math.cos(-armA) * 2.8 + 2.6; }
      else { const q = (W.o === 'wshield' ? FIGHT_BACK.shield : FIGHT_BACK.free)[ff]; bx = -0.4 + q[0]; by = shY + 0.4 + q[1]; }
      wA.bx = bx; wA.by = by;
    }
    if (armed && !sling) upper(() => {
      // дальняя рука: за телом, держит щит, второй кинжал, древко или тетиву
      smoothLimb(c, [-0.4, shY + 0.4], [(-0.4 + wA.bx) / 2 + 0.3, (shY + 0.4 + wA.by) / 2 + 0.7], [wA.bx, wA.by], 2.2, shade(shirt, -0.35));
      if (W.o && WPN_STYLE[W.o] === 'stab') { const d = ff === 'windup' || ff === 'parry' ? [0.95, -0.3] : [0.85, 0.52]; drawWeapon(c, W.o, wA.bx, wA.by, d[0], d[1]); }
      hand(c, wA.bx, wA.by, skin[2]);
    });
    else if (!tool && !carry && pose !== 'smoke') upper(() => {
      const ex = Math.sin(-armA) * 2.8, ey = shY + Math.cos(-armA) * 2.8;
      smoothLimb(c, [-0.4, shY + 0.4], [ex, ey], [ex + 0.8, ey + 2.6], 2.2, shade(shirt, -0.35));
      hand(c, ex + 0.8, ey + 3, skin[2]);
    });
    drawLeg(legs[0]);
    upper(() => {
      if (courier) drawFrame(c, 'E', -3, shY + 3);
      if (carry && courier) {
        const rot = carry === 'trunk' || carry === 'timber' || carry === 'staff';
        const step = rot ? 4.6 : 3.4;
        for (let k = carryN - 1; k >= 0; k--) { c.save(); c.translate(-5.2 + (k % 2 ? 0.4 : 0), shY - (carryN - 1 - k) * step + (carryN - 1) * step * 0.4); c.rotate(-Math.PI / 2 * (rot ? 1 : 0)); drawLoad(c, carry); c.restore(); }
      }
      if (O.staff && !W) line(c, -2.8, shY + 6, -1.2, shY - 8, '#6a4424', 0.8);
      if (W) {
        // секира, посох, лук и щит — за спиной (ножны рисуются поверх туловища, ниже)
        if (WPN_BACK[W.m] && !armed) drawOnBack(c, W.m, -2.4, shY + 3.4, 'E');
        if (W.o === 'wshield' && !armed) drawOnBack(c, 'wshield', -3.4, shY + 3.6, 'E');
      }
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
      if (fem) {
        c.beginPath(); c.moveTo(-3.2, hipY - 0.2); c.lineTo(3.8, hipY - 0.2); c.quadraticCurveTo(5.6, -3.6, 6.4, -1.6);
        for (let k = 0; k < 5; k++) c.quadraticCurveTo(6.4 - (k + 0.5) * 2.4, -0.5, 6.4 - (k + 1) * 2.4, -1.6);
        c.quadraticCurveTo(-4.6, -4, -3.2, hipY - 0.2); c.closePath();
        c.fillStyle = lingrad(c, -5, 0, 6, 0, [[0, shade(skirtCol, 0.2)], [0.6, skirtCol], [1, shade(skirtCol, -0.4)]]); c.fill();
        c.fillStyle = O.fem ? '#e8c860' : shade(skirtCol, 0.35); c.fillRect(-5.2, -1.9, 11.4, 0.5);
        if (skirtApron) { c.fillStyle = skirtApron; c.beginPath(); c.moveTo(1.4, hipY); c.lineTo(4, hipY); c.lineTo(5.4, -2); c.lineTo(1.8, -2); c.closePath(); c.fill(); }
      }
      if (O.fem) {
        ellipse(c, 2.9, shY + 3.1, 2.3, 2.4, skin[0]); c.fillStyle = '#3f7a46'; c.beginPath(); c.ellipse(2.9, shY + 4.3, 2.4, 1.5, 0, 0, Math.PI); c.fill();    // грудь в профиль
        ellipse(c, 2.5, shY + 2.2, 0.8, 0.6, 'rgba(255,240,225,0.7)'); ellipse(c, 1.6, shY + 0.4, 2.2, 1, skin[0]);
      }
      if (O.vest) { c.fillStyle = O.vest; c.beginPath(); c.moveTo(-2, shY); c.lineTo(1.8, shY); c.quadraticCurveTo(4.4, shY + 3, 3, hipY + 0.6); c.lineTo(-2.4, hipY + 0.6); c.fill(); }
      if (O.apron && !fem) { c.fillStyle = lingrad(c, 0, shY + 1, 0, -2.4, [[0, O.apron], [1, shade(O.apron, -0.25)]]); c.beginPath(); c.moveTo(1.2, shY + 2); c.lineTo(3.8, shY + 2.4); c.quadraticCurveTo(5, -5, 3.8 + sw * 0.4, -2.4); c.lineTo(1.4, -2.4); c.closePath(); c.fill(); if (O.blood) { ellipse(c, 3, -7.4, 0.6, 0.8, '#9c2c20'); ellipse(c, 3.3, -4.8, 0.5, 0.6, '#ac3e2a'); } }
      if (!O.robe) {
        c.fillStyle = '#5a3a1e'; c.fillRect(-3, hipY - 0.3, 6.8, 1.5);
        c.fillStyle = '#c8a050'; c.fillRect(2.4, hipY - 0.3, 1.1, 1.5);
        c.fillStyle = '#7a5030'; rrect(c, -3.2, hipY + 0.8, 1.8, 2, 0.5); c.fill();
        if (O.belt === 'hammer') { line(c, -1.4, hipY + 0.8, -1.8, hipY + 3.6, '#6a4424', 0.6); c.fillStyle = '#6a6a70'; c.fillRect(-2.4, hipY + 0.4, 1.8, 0.9); }
        if (O.belt === 'axe') { line(c, -1.6, hipY + 0.6, -2.4, hipY + 4, '#6a4424', 0.6); poly(c, [[-2.4, hipY + 3.6], [-3.8, hipY + 3.2], [-3.6, hipY + 4.8]], '#b8bcc0'); }
      }
      if (W) {
        // ножны на левом бедре — поверх туловища: ремень-портупея, ножны хвостом назад, над поясом торчит рукоять
        const st = WPN_STYLE[W.m];
        if (W.m === 'mace' || W.m === 'cmace') { if (!armed) drawWeapon(c, W.m, -2.6, hipY - 0.8, -0.45, 0.9); }
        else if (st === 'blade' || st === 'stab') {
          line(c, -3.2, hipY - 0.4, 1.6, hipY + 0.6, '#3a2414', 0.8);
          drawSheath(c, W.m, -2.8, hipY + 0.5, -0.66 + (pose === 'walk' ? sw * 0.12 : 0), 0.75, !armed);
        }
        if (W.o && WPN_STYLE[W.o] === 'stab') drawSheath(c, W.o, -3.6, hipY + 0.7, -0.5, 0.86, !armed);
      }
      if (courier) line(c, -2, shY + 0.2, 2.4, hipY, '#4a2c14', 0.6);
      if (O.skCape >= 0) skinCape(c, O.skCape, 'E', shY, hipY, false);
      if (L.wild) wildBody(c, 'E', L, shY, hipY, headY, sw);
      head(0.6, () => {
        drawHead(c, 'E', 0.6, headY, L, O, type, false, beardBottom, r);   // курево рисует drawSmoking (smoking.js)
        if (!opt.nohat) { if (O.skHat >= 0) skinHat(c, O.skHat, 'E', 0.6, headY, tipSway); else drawCap(c, O, 'E', 0.6, headY, tipSway, L, r, lvl); }
      });
      if (sling) {
        poly(c, [[-0.4, shY + 0.6], [3.4, shY + 3.2], [-0.8, shY + 4.4]], '#f4f0e6', 'rgba(120,110,100,0.6)', 0.3);
        smoothLimb(c, [0.4, shY + 0.4], [0.6, shY + 3], [2.8, shY + 3], 2, shirt);
        hand(c, 3, shY + 3, skin[0]);
      } else if (armed) {
        const { hx, hy, dx, dy } = wA;
        if (W.o === 'wshield') drawShield(c, wA.bx + 0.9, wA.by - 0.6, 1.7, 3.9);          // щит перед грудью
        if (fight === 'strike' && (wst === 'blade' || wst === 'heavy')) {
          // след удара: светлая дуга от замаха к удару
          const R0 = 4.2 + (wst === 'heavy' ? 7.4 : 7.2);
          c.strokeStyle = 'rgba(250,246,230,0.7)'; c.lineWidth = 1.3; c.lineCap = 'round';
          c.beginPath(); c.arc(0.4, shY + 0.4, R0 * 0.82, -2.1, -0.15); c.stroke();
        }
        if (wst === 'bow') drawBow(c, W.m, hx, hy, wA.Wd, ff === 'windup' ? [wA.bx, wA.by] : null);
        else if (wst !== 'fist') drawWeapon(c, W.m, hx, hy, dx, dy, (ff === 'draw' || ff === 'd0' || ff === 's3') && (wst === 'blade' || wst === 'stab') ? 'hilt' : undefined);
        if (wst === 'staff' && (fight === 'windup' || fight === 'strike' || fight === 'win0' || fight === 'win1' || (isCastF(fight) && fight !== 'c0' && fight !== 'c5'))) {
          // посох копит и выпускает силу: свечение на конце
          const t = 8.4, gx = hx + dx * t, gy = hy + dy * t, big = fight === 'strike' || fight === 'c3';
          const col = W.m === 'wstaff' ? ['#7ae070', '#e8ffd0'] : W.m === 'sstaff' ? ['#8ad8ff', '#fffbe0'] : ['#ffb040', '#fff0a0'];
          ellipse(c, gx, gy, big ? 2.2 : 1.4, big ? 2.2 : 1.4, col[0]); ellipse(c, gx, gy, big ? 1.1 : 0.7, big ? 1.1 : 0.7, col[1]);
        }
        smoothLimb(c, [0.4, shY + 0.4], [(0.4 + hx) / 2 + 0.4, (shY + 0.4 + hy) / 2 + 0.6], [hx, hy], 2.1, shirt);
        if (wst === 'fist') {
          // кулак (у монаха — в обмотках)
          ellipse(c, hx, hy, fight === 'strike' || fight === 'bhit' ? 1.95 : 1.5, fight === 'strike' || fight === 'bhit' ? 1.9 : 1.45, skin[1]);
          if (fight && BOTTLE_POSE[fight]) drawBottle(c, hx, hy, BOTTLE_POSE[fight][0], BOTTLE_POSE[fight][1]);
          if (W.m === 'fists') { line(c, hx - 1.2, hy - 0.4, hx + 1.2, hy - 0.4, '#e8dcc0', 0.45); line(c, hx - 1.2, hy + 0.5, hx + 1.2, hy + 0.5, '#e8dcc0', 0.45); }
        } else hand(c, hx, hy, skin[1]);
      } else if (tool) {
        const hx = 0.4 + Math.sin(ang) * 3.8, hy = shY - Math.cos(ang) * 3.8;
        const tx = hx + Math.sin(ang) * 6.5, ty = hy - Math.cos(ang) * 6.5;
        smoothLimb(c, [0.4, shY + 0.4], [(0.4 + hx) / 2 + 0.6, (shY + hy) / 2 + 0.5], [hx, hy], 2.1, shirt);
        if (tool !== 'toss' && tool !== 'pat' && tool !== 'bucket') line(c, hx - (tx - hx) * 0.25, hy - (ty - hy) * 0.25, tx, ty, '#6e4428', 0.9);
        const nx = -(ty - hy) / 6.5, ny = (tx - hx) / 6.5;
        if (tool === 'toss' || tool === 'pat') { /* пустая рука */ }
        else if (tool === 'bucket') {   // ведро с водой: после броска (кадры 5–7) пустое
          const bx = hx + Math.sin(ang) * 2.2, by = hy - Math.cos(ang) * 2.2, full = frame.f < 5;
          c.fillStyle = '#5a3a1e'; c.fillRect(Math.round(bx - 2), Math.round(by - 1), 4, 3);
          c.fillStyle = '#9a6a3a'; c.fillRect(Math.round(bx - 2), Math.round(by - 1), 4, 1);
          c.fillStyle = '#3a3a3e'; c.fillRect(Math.round(bx - 2), Math.round(by), 4, 1);
          if (full) { c.fillStyle = '#6ab8ff'; c.fillRect(Math.round(bx - 1), Math.round(by - 2), 2, 1); }
        }
        else if (tool === 'axe') poly(c, [[tx, ty], [tx + nx * 2.4, ty + ny * 2.4], [tx + nx * 2.2 - (tx - hx) * 0.22, ty + ny * 2.2 - (ty - hy) * 0.22], [tx - (tx - hx) * 0.15, ty - (ty - hy) * 0.15]], '#b8bcc0', '#3a3a3e', 0.3);
        else if (tool === 'pick') { c.strokeStyle = '#8a8e92'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(tx - nx * 3.2, ty - ny * 3.2); c.quadraticCurveTo(tx + (tx - hx) * 0.08, ty + (ty - hy) * 0.08, tx + nx * 3.2, ty + ny * 3.2); c.stroke(); }
        else if (tool === 'hammer') { c.save(); c.translate(tx, ty); c.rotate(Math.atan2(ty - hy, tx - hx)); c.fillStyle = '#5c564f'; c.fillRect(-0.8, -1.7, 2, 3.4); c.fillStyle = '#9e958a'; c.fillRect(-0.8, -1.7, 2, 0.6); c.restore(); }
        else if (tool === 'hook') {
          // длинный шест с крюком и корзинкой: тянут вниз лозу и обрывают шишки
          c.strokeStyle = '#6e4428'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + (tx - hx) * 0.9, ty + (ty - hy) * 0.9); c.stroke();
          const kx = tx + (tx - hx) * 0.9, ky = ty + (ty - hy) * 0.9;
          c.strokeStyle = '#2a1c10'; c.lineWidth = 0.8; c.beginPath(); c.arc(kx + nx * 1.4, ky + ny * 1.4, 1.5, 0, Math.PI * 1.5); c.stroke();
          ellipse(c, kx + nx * 2.2, ky + ny * 2.2, 1, 1.3, '#a8d860');
        }
        else if (tool === 'sickle') { c.strokeStyle = '#d0d4d8'; c.lineWidth = 0.8; c.beginPath(); c.arc(tx + nx * 1.6, ty + ny * 1.6, 2, Math.atan2(ny, nx) + Math.PI * 0.2, Math.atan2(ny, nx) + Math.PI * 1.2); c.stroke(); }
        else { c.fillStyle = '#9e958a'; c.save(); c.translate(tx, ty); c.rotate(Math.atan2(ty - hy, tx - hx)); c.fillRect(0, -1.2, 2.4, 2.4); c.restore(); }
        hand(c, hx, hy, skin[1]);
      } else if (gest) {
        const [e, h] = gestPts(gest, gf, 1, shY, headY, 'E');
        smoothLimb(c, [0.4, shY + 0.4], e, h, 2.1, shirt);
        hand(c, h[0], h[1], skin[0]);
        if (gest === 'yawn') ellipse(c, 3.6, headY + 3.6, 0.8, 0.6, '#3a1408');
        if (gest === 'drink') drawFlask(c, h[0] + 1.8, h[1] - 0.8, 0.5);
        if (gest === 'chest' && gf >= 0.5) drawFlask(c, h[0] + 2.2, h[1] - 1.6, 0.2);
      } else if (pose === 'smoke') {
        const sa = SMOKE_ARM.E, sf = frame | 0;   // кадр курения 0..3: достал, поднёс, затяжка, выдох
        smoothLimb(c, [0.4, shY + 0.4], sa.elbow[sf], sa.hand[sf], 2, shirt);
        hand(c, sa.hand[sf][0], sa.hand[sf][1], skin[0]);
      } else if (pose === 'tame') {
        smoothLimb(c, [0.4, shY + 0.4], [3, shY + 1.4], [5.8, shY + 2.4], 2, shirt);
        hand(c, 6.1, shY + 2.4, skin[0]);
      } else if (carry && !courier) {
        c.save(); c.translate(-0.6, headY - 6.4); drawLoads(c, carry, carryN); c.restore();
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
    if (carry && courier && front) { c.save(); c.translate(0, headY - 4); drawLoads(c, carry, carryN); c.restore(); }
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
      if (pose === 'smoke' && front && side > 0) {
        // трубка у рта: рука поднята, локоть в сторону
        const sa = SMOKE_ARM.S, sf = frame | 0;
        smoothLimb(c, [sx, shY + 0.6], sa.elbow[sf], sa.hand[sf], 2.2, col);
        hand(c, sa.hand[sf][0], sa.hand[sf][1], sk);
        return;
      }
      if (gest && (side > 0 || gest === 'stretch' || gest === 'clap' || gest === 'panic' || gest === 'six7')) {
        const [e, h] = gestPts(gest, gf, side, shY, headY, 'S');
        smoothLimb(c, [sx, shY + 0.6], e, h, 2.2, col);
        hand(c, h[0], h[1], sk);
        if (gest === 'drink') drawFlask(c, h[0] + 2.4, h[1] - 0.8, 0.3);
        if (gest === 'chest' && gf >= 0.5) drawFlask(c, h[0] + 2.2, h[1] - 1.4, 0.2);
        return;
      }
      if (carry && !courier) {
        smoothLimb(c, [sx, shY + 0.6], [side * 5, shY - 1], [side * 2.6, headY - 3.6], 2, col);
        hand(c, side * 2.6, headY - 4, sk);
        return;
      }
      // руки-кулаки у бёдер, как у гнома с референса
      const hy = hipY - 0.2 + (side > 0 ? armSw : -armSw) * (front ? 1 : -1);
      // выхваченное оружие: в правой руке (спереди — слева от нас), щит или кинжал — в левой
      const wHand = armed && side === (front ? -1 : 1), oHand = armed && !wHand && W.o;
      if (wHand && wst !== 'fist') {
        const v = wst === 'heavy' ? [side * 0.3, -0.95] : wst === 'staff' ? [side * 0.12, -0.99] : wst === 'blade' ? [side * 0.34, -0.94] : [side * 0.42, 0.9];
        if (wst === 'bow') drawBow(c, W.m, side * 5.1, hy + 0.5, 0, null); else drawWeapon(c, W.m, side * 5.1, hy + 0.5, v[0], v[1]);
      }
      if (oHand && W.o !== 'wshield') drawWeapon(c, W.o, side * 5.1, hy + 0.5, side * 0.4, 0.92);
      smoothLimb(c, [sx, shY + 0.6], [side * 5.4, (shY + hy) / 2], [side * 5, hy], 2.3, col);
      hand(c, side * 5.1, hy + 0.5, sk);
      if (oHand === 'wshield') drawShield(c, side * 5.4, hy - 0.4, front ? 2.6 : 2.2, 3.2);
    };
    // спереди из-за спины выглядывают посох, лук или секира
    if (W && front && !armed && WPN_BACK[W.m]) drawOnBack(c, W.m, 3.6, shY + 2.6, 'S');
    if (!front) { arm(-1); arm(1); }
    tunicFront();
    if (O.robe) {
      if (front && O.vest) { c.fillStyle = O.vest; c.fillRect(-3.8, shY + 0.4, 2.4, 5.4); c.fillRect(1.4, shY + 0.4, 2.4, 5.4); }
      c.fillStyle = '#c89226'; c.fillRect(-5, -1.4, 10, 0.5); if (front) c.fillRect(-0.3, shY, 0.6, 12);
    }
    else {
      if (front) {
        if (O.vest) { c.fillStyle = O.vest; c.fillRect(-3.8, shY + 0.4, 2.4, 5.4); c.fillRect(1.4, shY + 0.4, 2.4, 5.4); if (O.rivets) { c.fillStyle = '#cec6ba'; for (let k = 0; k < 3; k++) { c.fillRect(-2.8, shY + 1.4 + k * 1.6, 0.4, 0.4); c.fillRect(2.4, shY + 1.4 + k * 1.6, 0.4, 0.4); } } }
        if (O.apron && !fem) { c.fillStyle = lingrad(c, 0, shY + 1.6, 0, -1.6, [[0, O.apron], [1, shade(O.apron, -0.25)]]); c.beginPath(); c.moveTo(-2.8, shY + 2); c.lineTo(2.8, shY + 2); c.lineTo(3.4, -1.6); c.lineTo(-3.4, -1.6); c.closePath(); c.fill(); if (O.blood) { ellipse(c, -1, -6.4, 0.7, 0.9, '#9c2c20'); ellipse(c, 1.4, -4, 0.6, 0.7, '#ac3e2a'); } }
        if (courier) { line(c, -2.8, shY, -2.6, hipY, '#4a2c14', 0.8); line(c, 2.8, shY, 2.6, hipY, '#4a2c14', 0.8); }
      }
      if (fem) femSkirt(c, hipY, front, sw, skirtCol, skirtApron, !!O.fem);
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
    if (O.fem && front) femBust(c, shY, skin);
    if (W) {
      // ножны на левом бедре (спереди — справа от нас, со спины — слева), кинжал — на правом
      const st = WPN_STYLE[W.m], sx = front ? 4.5 : -4.5, sd = front ? 0.55 : -0.55;
      if (W.m === 'mace' || W.m === 'cmace') { if (!armed) drawWeapon(c, W.m, sx, hipY - 0.6, sd * 0.6, 0.95); }
      else if (st === 'blade' || st === 'stab') drawSheath(c, W.m, sx, hipY + 0.3, sd, 0.9, !armed);
      if (W.o && WPN_STYLE[W.o] === 'stab') drawSheath(c, W.o, -sx, hipY + 0.4, -sd, 0.9, !armed);
    }
    if (O.skCape >= 0 && !front) skinCape(c, O.skCape, view, shY, hipY, true);
    if (L.wild) wildBody(c, view, L, shY, hipY, headY, sw);
    if (front) { arm(-1); arm(1); }
    head(0, () => {
      drawHead(c, view, 0, headY, L, O, type, false, beardBottom, r);
      if (!opt.nohat) { if (O.skHat >= 0) skinHat(c, O.skHat, view, 0, headY, tipSway); else drawCap(c, O, view, 0, headY, tipSway, L, r, lvl); }
    });
    // поднятая рука жеста — поверх головы и бороды
    if (gest && front) { arm(1); if (gest === 'stretch' || gest === 'clap' || gest === 'panic' || gest === 'six7') arm(-1); }
    if (pose === 'smoke' && front) {
      arm(1);
    }
    if (W && !front && !armed) {
      // со спины: щит и оружие на ремне поверх туники
      if (W.o === 'wshield') drawShield(c, 0, shY + 3.8, 3.1, 3.6);
      if (WPN_BACK[W.m]) drawOnBack(c, W.m, -1.2, shY + 2.6, 'N');
    }
    if (courier && !front) {
      drawFrame(c, 'N', 0, shY + 2.6);
      if (carry) { c.save(); c.translate(0, shY + 0.6); drawLoads(c, carry, carryN); c.restore(); }
    }
    if (carry && !courier) { c.save(); c.translate(0, headY - 6.6); drawLoads(c, carry, carryN); c.restore(); }
    c.restore();
  }
  c.restore();
}

const PEOPLE_CACHE = new Map();

// Внешность выбирается из 64 вариантов: в большом городе гномы делят наборы кадров,
// иначе у каждого свои сотни спрайтов и кэш не справляется.
const LOOK_POOL = Array.from({ length: 64 }, (_, i) => (Math.imul(i + 7, 2654435761) >>> 12) & 0xffff);
const PEOPLE_CACHE_MAX = 4500;
let PEOPLE_SCRATCH = null;

// Новые кадры спрайтов (гномы, голем) рисуются по бюджету времени на кадр, а не «не больше 8 штук»:
// на ПК кадр гнома ~1 мс, на слабом телефоне ~6 мс, и восемь подряд роняли кадр до 50+ мс
// (особенно в первые секунды игры, когда кэш пуст). Кто уже имеет прошлый кадр — подождёт следующего.
const SPRITE_BUDGET_MS = 6;
function spriteBudgetOk(hasFallback) {
  if (!R.newSprites) R.sprMs = 0;          // render обнуляет счётчик в начале каждого кадра
  R.newSprites = (R.newSprites || 0) + 1;
  return !hasFallback || (R.sprMs || 0) < SPRITE_BUDGET_MS;
}
function spriteSpent(t0) { R.sprMs = (R.sprMs || 0) + performance.now() - t0; }

// пол для рисования: семья (family.js), героиня (u.hero.sx), снимок жертвы нечисти или кооп-пакет (u.sx)
function personSex(u) {
  if (!u) return '';
  if (u.sx === 'f' || (u.fam && u.fam.sx === 'f')) return 'f';
  const ap = u.type === 'hero' && typeof haOf === 'function' ? haOf(u) : null;   // героиня: облик ap[10] (heroapp.js)
  return ap && ap[10] === 1 ? 'f' : '';
}
function personSprite(u, view, pose, frame, opt = {}) {
  const sx = u.type === 'waitress' ? '' : personSex(u);
  const look = (u.look >>> 0) >= 0x20000 ? u.look : LOOK_POOL[(u.look >>> 0) % LOOK_POOL.length];   // 0x20000+ — особые гномы наследия (legacy.js)
  const fkey = pose === 'work' ? `${frame.anim}${frame.f}` : frame;
  const lvl = (u.type === 'serf' || u.type === 'builder') ? unitLevel(u) : 1;
  const carryN = u.carry ? Math.min(3, Math.max(1, u.carryN || 1)) : 0;
  const okey = `${opt.gait || ''}${opt.gest ? opt.gest + (opt.gest === 'five' ? (opt.gf || 0) : gestK(opt.gf || 0)) : ''}${lvl > 1 ? 'L' + lvl : ''}${carryN > 1 ? 'x' + carryN : ''}${opt.wpn ? 'W' + opt.wpn : ''}${opt.nohat ? 'H0' : ''}`;
  const key = `${u.type}|${look}${sx}|${view}${pose}${fkey}|${u.carry || ''}|${u.injury || ''}|${okey}`;
  let cv = PEOPLE_CACHE.get(key);
  if (cv) {
    // недавно нужные кадры — в конец очереди, вытесняются самые давние
    PEOPLE_CACHE.delete(key); PEOPLE_CACHE.set(key, cv);
    u._spr = cv;
    return cv;
  }
  // не больше 8 новых кадров за кадр отрисовки: иначе толпа на экране даёт рывок
  if (!spriteBudgetOk(!!u._spr)) return u._spr;
  const t0 = performance.now();
  // один черновой холст на всех: меньше мусора в памяти — меньше подвисаний на сборке
  if (!PEOPLE_SCRATCH) PEOPLE_SCRATCH = mkSprite(PW, PH, PS);
  const [c2, ctx] = PEOPLE_SCRATCH;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c2.width, c2.height);
  ctx.setTransform(PS, 0, 0, PS, 0, 0); ctx.globalAlpha = 1;
  // мох и крапинки одинаковые у одного гнома во всех кадрах
  drawPerson(ctx, u.type, lookOf({ type: u.type, look, sx }), view, pose, frame, u.carry, u.injury, mulberry32(look * 977 + 13), { ...opt, lvl, carryN });
  cv = toPixelArt(c2, PS / PART, { outline: true, outlineDark: 0.36, alphaCut: 105 });
  if (PEOPLE_CACHE.size >= PEOPLE_CACHE_MAX) PEOPLE_CACHE.delete(PEOPLE_CACHE.keys().next().value);
  PEOPLE_CACHE.set(key, cv);
  u._spr = cv;
  spriteSpent(t0);
  return cv;
}

// Портрет для интерфейса: голова, уши и колпак крупно.
const PORTRAIT_CACHE = new Map();
function portraitURL(type, look = 3, sx = '') {
  const key = type + look + sx;
  if (PORTRAIT_CACHE.has(key)) return PORTRAIT_CACHE.get(key);
  const cv = mkCanvas(48, 48);
  const c = cv.getContext('2d');
  c.fillStyle = radgrad(c, 24, 18, 2, 34, [[0, '#4a5a30'], [1, '#141a0c']]); c.fillRect(0, 0, 48, 48);
  c.imageSmoothingEnabled = false;
  if (UNIT_TYPES[type] && UNIT_TYPES[type].animal) {
    c.imageSmoothingEnabled = true;
    c.drawImage(creatureSprite('packgoat', 0, null), 0, 0, 48, 48);
  } else {
    const spr = personSprite({ type, look, sx, carry: null }, 'S', 'idle', 0);
    // область головы: x 1..25, y 0..24 мировых пикселей
    c.drawImage(spr, 1 * PART, 0, 24 * PART, 24 * PART, 0, 0, 48, 48);
  }
  const url = cv.toDataURL();
  PORTRAIT_CACHE.set(key, url);
  return url;
}

