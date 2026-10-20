'use strict';
// Лепрекон: пиксель-арт кадры (стандарт КАДРЫ.md: покой 6, ходьба 8). Рисуется векторно в 3× и сводится в пиксели
// (toPixelArt) — тот же конвейер, что у нейтралов (neutralart.js). Все кадры смотрят вправо, влево — отражением.
// Начало координат — точка земли под ногами; бедро в (0, −10).
//
// Кадры (всего 68):
//   покой i0..i5 (6) · ходьба w0..w7 (8)
//   ИРЛАНДСКИЙ ТАНЕЦ p0..p15 (16): две фразы по 8 — присед, подскок с щелчком каблуков, мах ногой, носок, нога за голень,
//     перекрест ног, глубокий присед, прыжок «ножницы»; во второй фразе ноги меняются. Руки на поясе, спина прямая, шляпа пляшет
//   перетягивание слитка t0..t2 (3) — упёрся, рванул, откинулся
//   исход (а) «лепрекон украл»: x0 рывок · x1 победный прыжок со слитком · x2 нырок в горшок · x3 сидит в горшке (4)
//   исход (б) «пощёчина»: l0 съёжился · l1 «ПЛЯК» (голова мотнулась) · l2, l3 шатание · l4, l5 рука на щеке, грустный ·
//     l6, l7, l8 растворение в зелёных искрах (9)
//   горшок: potB (задняя стенка и золото) и potF (передняя стенка) — рисуются слоями вокруг прыгающего лепрекона
const LP = {
  coat: '#2fa04a', coatD: '#1c6e32', coatL: '#5cc86a', vest: '#e8c040', vestD: '#b8901c', shirt: '#f4f0e0',
  brch: '#1f6a34', sock: '#f2eede', sockD: '#c8c2aa', shoe: '#1a1410', gold: '#f6d458', goldD: '#c49a20', goldL: '#fff2a0',
  skin: '#f2b48a', skinD: '#d98f66', blush: '#e8706a', beard: '#e46a1e', beardD: '#b24a10', beardL: '#f6944a',
  hat: '#2a9448', hatD: '#17622c', hatL: '#58c868', band: '#16120e',
};

const LEP_IDLE = ['i0', 'i1', 'i2', 'i3', 'i4', 'i5'];
const LEP_WALK = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'];
const LEP_DANCE = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'p13', 'p14', 'p15'];
const LEP_TUG = ['t0', 't1', 't2'];
const LEP_STEAL = ['x0', 'x1', 'x2', 'x3'];
const LEP_SLAP = ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8'];
const LEP_ALL = [].concat(LEP_IDLE, LEP_WALK, LEP_DANCE, LEP_TUG, LEP_STEAL, LEP_SLAP);

// ---------- позы ----------
// y — подъём тела (минус = вверх), x — сдвиг; rot — наклон; lf/rf — ступни (от земли), lh/rh — кисти (от бедра);
// ep — куда сгибать локти ('hip' — руки на поясе); tip — шляпа приподнята рукой; hat — наклон шляпы; mouth/eye;
// ingot: 1 — слиток в руках, 2 — над головой; click — искры щелчка каблуков; cheek/hurt/fade — пощёчина

const LEP_HIPS = { lh: [-4.4, -1.4], rh: [4.6, -1.4], ep: 'hip' };       // руки на поясе (кисти по обе стороны бёдер)

function lepPose(n) {
  const d = (o) => Object.assign({ x: 0, y: 0, rot: 0, lf: [-2.6, 0], rf: [2.6, 0], lh: [-5.4, 2.4], rh: [5.6, 1.4], ep: '', hat: 0, mouth: 0, eye: 0, ingot: 0, click: 0, cheek: 0, hurt: 0, fade: 0, tip: 0, head: 0, sq: 1, stars: 0 }, o);
  let m;
  if ((m = /^i(\d)$/.exec(n))) {          // покой: дыхание, поза «руки в боки/большие пальцы за жилет», приподнимает шляпу, поглаживает кошель
    const k = +m[1], br = [0, -0.3, -0.7, -0.7, -0.3, 0][k];
    const P = d({ y: br, sq: 1 + (k === 2 || k === 3 ? 0.012 : 0), eye: k === 4 ? 2 : 0, hat: [0, 0.02, 0.05, 0.05, 0.02, 0][k], mouth: k === 3 ? 0.4 : 0 });
    if (k === 2 || k === 3) { P.rh = [5, -18]; P.tip = 1; P.lh = [-4.4, -1.4]; }                 // коснулся шляпы
    else if (k === 1) { P.lh = [-4.2, -2]; P.rh = [4.6, -3.4]; P.ep = 'hip'; }               // большие пальцы за жилет
    else if (k === 5) { P.rh = [4.2, -2.4]; P.lh = [-5.4, 2.4]; }
    return P;
  }
  if ((m = /^w(\d)$/.exec(n))) {          // ходьба: 8 кадров, шаг пружинистый, носки врозь
    const ph = +m[1] / 8 * 6.2832, s = Math.sin(ph), c = Math.cos(ph);
    return d({
      y: -Math.abs(s) * 1.1 + 0.3, rot: 0.04 * s, lf: [-s * 5.4, -Math.max(0, c) * 3.4], rf: [s * 5.4, -Math.max(0, -c) * 3.4],
      lh: [-4 - s * 3.6, 2], rh: [4.2 + s * 3.6, 1.6], hat: -0.03 * c, mouth: 0,
    });
  }
  if ((m = /^p(\d+)$/.exec(n))) return lepDancePose(+m[1], d);
  switch (n) {
    // перетягивание: обеими руками держит слиток, который тянет к себе (вправо — гном)
    case 't0': return d({ x: 1, rot: 0.16, y: 1, lf: [-4.5, 0], rf: [3.5, 0], lh: [10, -8.5], rh: [11.5, -6.5], eye: 1, mouth: 0.5, ep: 'tug' });
    case 't1': return d({ x: -2.5, rot: -0.3, y: 0.5, lf: [-6, 0], rf: [1, 0], lh: [9.5, -9.5], rh: [11, -7.5], eye: 1, mouth: 0.9, ep: 'tug', hat: -0.1 });
    case 't2': return d({ x: -4, rot: -0.44, y: 1.5, lf: [-8, 0], rf: [-1, 0], lh: [9, -10], rh: [10.5, -8], eye: 1, mouth: 1, ep: 'tug', hat: -0.16 });
    // исход (а): рывок, победный прыжок, нырок в горшок, сидит в горшке
    case 'x0': return d({ x: 5, rot: 0.34, y: 1, lf: [-5, 0], rf: [5, 0], lh: [12, -8], rh: [13.5, -10], eye: 1, mouth: 1, ep: 'tug', hat: 0.12 });
    case 'x1': return d({ y: -9, rot: -0.08, lf: [-3.5, -7], rf: [3.5, -5], lh: [-1, -19], rh: [6, -20], ingot: 2, mouth: 1, eye: 0, hat: -0.2, ep: 'up' });
    case 'x2': return d({ y: -5, x: 2, rot: 0.85, lf: [-7, -13], rf: [-3, -15], lh: [8, -4], rh: [9.5, -2], ingot: 1, mouth: 0.6, eye: 0, hat: 0.4, ep: 'dive' });
    case 'x3': return d({ y: 2, sq: 0.88, lf: [-2.5, 0], rf: [2.5, 0], lh: [-1, -17], rh: [5, -18], ingot: 2, mouth: 0.5, eye: 2, hat: 0.1, ep: 'up' });
    // исход (б): пощёчина
    case 'l0': return d({ x: -1, rot: -0.12, y: 1, lf: [-3.5, 0], rf: [3, 0], lh: [9.5, -8], rh: [10.5, -6], eye: 4, mouth: 0.5, ep: 'tug', hat: -0.04 });       // ждёт удара, зажмурился
    case 'l1': return d({ x: -6, rot: -0.46, y: -1, lf: [-8, -1], rf: [-1, 0], lh: [-6, -3], rh: [-3, -8], eye: 3, mouth: 0.9, head: -0.55, hurt: 1, cheek: 1, hat: -0.55, stars: 1, ep: '' });   // голова мотнулась
    case 'l2': return d({ x: -4, rot: -0.3, y: 0, lf: [-6, 0], rf: [0, -0.5], lh: [-7, -4], rh: [-6, -10], eye: 3, mouth: 0.6, head: -0.3, hurt: 0.6, cheek: 1, hat: -0.3, stars: 1 });
    case 'l3': return d({ x: -1, rot: 0.2, y: 0, lf: [-3, 0], rf: [3.5, -1.2], lh: [-6.4, -5], rh: [-4, -10.5], eye: 3, mouth: 0.4, head: 0.18, hurt: 0.3, cheek: 1, hat: 0.2, stars: 1 });
    case 'l4': return d({ x: -1, rot: 0.08, y: 1, lf: [-2.8, 0], rf: [2.6, 0], lh: [-5.6, 1.4], rh: [4.4, -9.4], eye: 5, mouth: -1, head: 0.05, cheek: 1, hat: 0.16, sq: 0.97, ep: 'cheek' });   // рука на щеке, грустные глаза
    case 'l5': return d({ x: -1, rot: 0.12, y: 1.6, lf: [-2.8, 0], rf: [2.6, 0], lh: [-5.6, 1.4], rh: [4.4, -9.2], eye: 6, mouth: -1, head: 0.1, cheek: 1, hat: 0.24, sq: 0.95, ep: 'cheek' });
    case 'l6': return d({ x: -1, rot: 0.1, y: 1.2, lf: [-2.8, 0], rf: [2.6, 0], lh: [-5.6, 1.4], rh: [4.4, -9.4], eye: 5, mouth: -1, head: 0.08, cheek: 1, hat: 0.2, fade: 0.34, ep: 'cheek' });
    case 'l7': return d({ x: -1, rot: 0.1, y: 0.4, lf: [-2.8, 0], rf: [2.6, 0], lh: [-5.6, 1.4], rh: [4.4, -9.4], eye: 5, mouth: -1, head: 0.08, cheek: 1, hat: 0.2, fade: 0.64, sq: 0.92, ep: 'cheek' });
    case 'l8': return d({ x: -1, rot: 0.1, y: 0, lf: [-2.8, 0], rf: [2.6, 0], lh: [-5.6, 1.4], rh: [4.4, -9.4], eye: 5, mouth: -1, head: 0.08, cheek: 1, hat: 0.2, fade: 0.9, sq: 0.88, ep: 'cheek' });
  }
  return d({});
}

// ирландский танец: две фразы по 8 тактов (вторая — зеркальная: ноги меняются)
function lepDancePose(k, d) {
  const sw = k >= 8, i = k % 8;
  // [y, x, rot, левая ступня, правая ступня, щелчок, шляпа]
  const A = [
    [1.4, 0, 0, [-3, 0], [3, 0], 0, 0.05],            // 0 присед, ноги врозь
    [-3.4, 0, 0.02, [-1.1, -3], [1.1, -3.4], 1, 0],       // 1 подскок: каблуки щёлкают друг о друга в воздухе
    [-5.8, 0.5, -0.05, [-3.4, -6.4], [3.6, -4.6], 0, -0.1],    // 2 пик подскока: левая поджата, правая вперёд
    [0, 1, 0.05, [5.6, -1.6], [-0.6, 0], 0, 0.06],         // 3 приземлился на правую, левая — носок вперёд
    [-3, 1, 0.05, [-1.4, -4.4], [-0.6, -3], 0, 0.1],       // 4 подскок на правой, левая за голень, колено вперёд
    [0.2, 0, 0, [1.6, 0], [-1.6, 0], 0, -0.04],            // 5 ноги скрещены (перекрест), стоит на носках
    [2.4, 0, 0.03, [1.8, 0], [-1.8, 0], 1, 0.1],           // 6 глубокий присед на скрещённых ногах, щелчок
    [-6.4, 0, -0.04, [-4.4, -4.4], [4.4, -4.4], 0, -0.16],     // 7 высокий прыжок «ножницы»
  ][i];
  const [y, x, rot, lf, rf, click, hat] = A;
  const mir = sw ? -1 : 1;
  const P = d({
    y, x, rot: rot * mir, hat: hat * mir, click, mouth: i === 7 || i === 1 ? 0.7 : 0.3, eye: 0,
    lf: sw ? [rf[0], rf[1]] : lf, rf: sw ? [lf[0], lf[1]] : rf, ...LEP_HIPS_MIX(),
  });
  // подпрыгивающая борода и поворот головы такта
  P.head = (i === 3 || i === 4 ? 0.1 : i === 7 ? -0.08 : 0) * mir;
  return P;
}
function LEP_HIPS_MIX() { return { lh: LEP_HIPS.lh.slice(), rh: LEP_HIPS.rh.slice(), ep: 'hip' }; }

// ---------- рисование ----------

// двухзвенная конечность с изгибом в нужную сторону (pref — куда смотрит сгиб)
function lepIK(ax, ay, bx, by, l1, l2, pref) {
  let dx = bx - ax, dy = by - ay, dist = Math.hypot(dx, dy) || 0.01;
  const max = l1 + l2 - 0.05;
  if (dist > max) { bx = ax + dx / dist * max; by = ay + dy / dist * max; dx = bx - ax; dy = by - ay; dist = max; }
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / dist, uy = dy / dist, mx = ax + ux * a, my = ay + uy * a;
  const p1 = [mx - uy * h, my + ux * h], p2 = [mx + uy * h, my - ux * h];
  const dot = p => (p[0] - mx) * pref[0] + (p[1] - my) * pref[1];
  const e = dot(p1) >= dot(p2) ? p1 : p2;
  return { e, b: [bx, by] };
}

function lepLimb(c, a, e, b, w1, w2, col1, col2) {
  naLimb(c, a[0], a[1], e[0], e[1], w1, col1);
  naLimb(c, e[0], e[1], b[0], b[1], w2, col2);
}

function lepShoe(c, x, y, col) {
  poly(c, [[x - 2.6, y - 1.4], [x + 1.6, y - 1.8], [x + 4.4, y - 0.5], [x + 4.4, y + 1.2], [x - 2.6, y + 1.2]], LP.shoe);
  poly(c, [[x - 2.6, y + 0.4], [x + 4.4, y + 0.4], [x + 4.4, y + 1.4], [x - 2.6, y + 1.4]], '#0a0806');
  c.fillStyle = LP.gold; c.fillRect(x + 0.6, y - 1.6, 1.5, 1.7);       // золотая пряжка
  c.fillStyle = LP.goldL; c.fillRect(x + 0.9, y - 1.3, 0.6, 0.6);
}

function lepIngot(c, x, y, rot, s = 1) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  poly(c, [[-5, 1.8], [5, 1.8], [3.6, -2], [-3.6, -2]], LP.gold, '#8a6410', 0.5);
  poly(c, [[-3.6, -2], [3.6, -2], [3.2, -1], [-3.2, -1]], LP.goldL);
  c.fillStyle = LP.goldD; c.fillRect(-4.2, 1, 8.4, 0.8);
  c.restore();
}

function drawLep(c, P) {
  const k = col => (P.hurt > 0.01 ? shade(col, P.hurt * 0.3) : col);
  c.save();
  c.translate(P.x, 0);
  // всё тело — от бедра: наклон вокруг ступней
  const hipY = -10 + P.y, hipX = 0;
  c.translate(0, hipY); c.rotate(P.rot); c.scale(1 / Math.sqrt(P.sq), P.sq);
  // ступни заданы от земли — переводим в систему бедра
  const toL = (pt) => {
    const wx = pt[0] - P.x, wy = pt[1] - hipY;
    const cs = Math.cos(-P.rot), sn = Math.sin(-P.rot);
    return [(wx * cs - wy * sn) * Math.sqrt(P.sq), (wx * sn + wy * cs) / P.sq];
  };
  const footL = toL([P.lf[0] + P.x, P.lf[1]]), footR = toL([P.rf[0] + P.x, P.rf[1]]);
  const leg = (hx, f, near) => {
    const r = lepIK(hx, 0, f[0], f[1] - 0.6, 6.2, 6.4, [1, 0.1]);
    const kn = r.e;
    naLimb(c, hx, 0, kn[0], kn[1], 3.6, k(near ? LP.brch : LP.coatD));
    naLimb(c, kn[0], kn[1], r.b[0], r.b[1], 2.5, k(near ? LP.sock : LP.sockD));
    c.fillStyle = k(LP.gold); c.fillRect(kn[0] - 1.6, kn[1] - 0.8, 3.2, 1);      // пряжка под коленом
    lepShoe(c, r.b[0], r.b[1] + 0.8, near);
  };
  // дальняя нога и дальняя рука
  leg(-1.8, footL, false);
  const sh = { far: [-2.8, -9.4], near: [3.2, -9.4] };
  const armTo = (s, hand, far) => {
    let pref = [-0.5, 1];
    if (P.ep === 'hip') pref = far ? [1, 0.2] : [-1, 0.3];
    else if (P.ep === 'tug') pref = [0.2, 1];
    else if (P.ep === 'up') pref = [far ? 1 : -1, 0.4];
    else if (P.ep === 'cheek') pref = [0.4, 1];
    return lepIK(s[0], s[1], hand[0], hand[1], 5.4, 5.6, pref);
  };
  const farHand = P.ep === 'tug' ? [P.lh[0] - 1.2, P.lh[1] + 1.4] : P.lh;
  const fa = armTo(sh.far, farHand, true);
  lepLimb(c, sh.far, fa.e, fa.b, 2.9, 2.5, k(LP.coatD), k(LP.coatD));
  ellipse(c, fa.b[0], fa.b[1], 1.5, 1.5, k(LP.skinD));
  // полы фрака и тело
  poly(c, [[-5.6, -2], [5.2, -2], [7.4, 3.6], [1.4, 2], [-1.6, 4.4], [-7, 3]], k(LP.coatD));
  poly(c, [[-6, -10.4], [5.6, -10.4], [6.8, -1], [-6.6, -1]], k(LP.coat));
  poly(c, [[-6, -10.4], [-3, -10.4], [-3, -1], [-6.6, -1]], k(LP.coatD));
  poly(c, [[3.2, -10.4], [5.6, -10.4], [6.8, -1], [4.2, -1]], k(LP.coatL));
  // жилет и рубашка
  poly(c, [[-2.2, -11], [2.2, -11], [2.6, -1.4], [-2.6, -1.4]], k(LP.vest));
  poly(c, [[-1.4, -11], [1.4, -11], [0, -8.6]], k(LP.shirt));
  c.fillStyle = k(LP.vestD); for (const by of [-6.8, -4.4]) c.fillRect(-0.4, by, 0.9, 0.9);
  // ремень с огромной золотой пряжкой
  c.fillStyle = LP.band; c.fillRect(-6.4, -2.6, 13, 1.7);
  poly(c, [[-1.8, -3.4], [1.8, -3.4], [1.8, -0.2], [-1.8, -0.2]], LP.gold, LP.goldD, 0.4);
  c.fillStyle = LP.band; c.fillRect(-0.8, -2.5, 1.6, 1.5);
  // ближняя нога
  leg(1.8, footR, true);
  // голова: наклон от шеи
  c.save();
  c.translate(0.6, -10.8); c.rotate(P.head); c.scale(1.14, 1.14);
  // борода — густая, рыжая, из-под щёк
  poly(c, [[-5.4, 1.6], [-6, 5], [-2.8, 8.6], [0.6, 10.4], [4, 8.6], [6.2, 5], [5.8, 1.8], [2.4, 3.8], [-1.6, 3.8]], k(LP.beard));
  poly(c, [[-5.4, 1.6], [-3.4, 3], [-3.4, 7.4], [-2.8, 8.6], [-6, 5]], k(LP.beardD));
  poly(c, [[1.6, 4], [4.4, 3.6], [5.4, 6.4], [3.6, 9], [2.4, 7]], k(LP.beardL));
  // лицо
  ellipse(c, 0.4, -0.6, 6, 5.6, k(LP.skin));
  ellipse(c, 2.8, 1.2, 2.6, 1.8, k(P.cheek ? LP.blush : LP.skinD));
  if (P.cheek && P.hurt > 0.01) ellipse(c, 2.8, 1.2, 3.1, 2.3, '#e84a44');       // красная щека от пощёчины
  // пышные усы и бакенбарды
  poly(c, [[-1.4, 3.2], [5.6, 2.6], [7.2, 4.4], [3.2, 5.2], [0.8, 4.4]], k(LP.beardL));
  poly(c, [[-5.2, -1], [-3.6, -2], [-3.4, 4.6], [-5.4, 5]], k(LP.beardD));
  // нос
  ellipse(c, 6, 0.4, 1.9, 1.7, k('#f08a68'));
  // глаза: 0 обычные, 1 азартные, 2 зажмурен, 3 крестиком, 4 зажмурился в ожидании, 5 грустные, 6 грустные с крупной слезой
  const ex = 2.8, ey = -2;
  if (P.eye === 2 || P.eye === 4) { c.strokeStyle = '#2a1408'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(ex - 1.2, ey + 0.4); c.lineTo(ex + 1.4, ey + 0.6); c.stroke(); }
  else if (P.eye === 3) { c.strokeStyle = '#2a1408'; c.lineWidth = 0.65; c.beginPath(); c.moveTo(ex - 1, ey - 1); c.lineTo(ex + 1.2, ey + 1); c.moveTo(ex + 1.2, ey - 1); c.lineTo(ex - 1, ey + 1); c.stroke(); }
  else {
    ellipse(c, ex, ey, 1.5, P.eye === 5 || P.eye === 6 ? 1.3 : 1.6, '#ffffff');
    ellipse(c, ex + 0.5, ey + (P.eye >= 5 ? 0.5 : 0.1), 0.85, 0.85, P.eye === 1 ? '#2a8a2a' : '#1a3a18');
    c.fillStyle = '#fff'; c.fillRect(ex + 0.2, ey - 0.4, 0.5, 0.5);
    if (P.eye === 1) { c.strokeStyle = LP.beardD; c.lineWidth = 0.8; c.beginPath(); c.moveTo(ex - 2, ey - 2.4); c.lineTo(ex + 2, ey - 1.6); c.stroke(); }          // азартная бровь
    if (P.eye >= 5) { c.strokeStyle = LP.beardD; c.lineWidth = 0.7; c.beginPath(); c.moveTo(ex - 2, ey - 1.4); c.lineTo(ex + 2, ey - 2.4); c.stroke(); }          // скорбная бровь домиком
    if (P.eye === 6) { c.fillStyle = '#9ad8ff'; c.fillRect(ex + 1.6, ey + 1.6, 1, 2); c.fillRect(ex + 1.8, ey + 3.2, 0.6, 0.6); }
  }
  // рот в бороде
  if (P.mouth > 0.3) ellipse(c, 3.2, 6.4, 1.6, 1 + P.mouth * 1.2, '#4a1408');
  else if (P.mouth < -0.3) { c.strokeStyle = '#4a1408'; c.lineWidth = 0.7; c.beginPath(); c.arc(3.2, 8, 1.7, 3.6, 5.8); c.stroke(); }
  else { c.strokeStyle = '#4a1408'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(2, 6.2); c.lineTo(4.6, 6.4); c.stroke(); }
  // шляпа: высокая, чёрная лента, большая золотая пряжка
  c.save();
  c.translate(0, -4.6); c.rotate(P.hat + (P.tip ? -0.22 : 0));
  poly(c, [[-5.6, 0.4], [5.8, 0.4], [7.6, 2.2], [-7, 2.2]], k(LP.hatD));
  poly(c, [[-4.6, 0.6], [4.8, 0.6], [4.2, -10.4], [-3.8, -10.4]], k(LP.hat));
  poly(c, [[-4.6, 0.6], [-2.4, 0.6], [-1.8, -10.4], [-3.8, -10.4]], k(LP.hatD));
  poly(c, [[2, 0.6], [4.8, 0.6], [4.2, -10.4], [2.4, -10.4]], k(LP.hatL));
  ellipse(c, 0.2, -10.4, 4, 1.2, k(LP.hatL));
  c.fillStyle = LP.band; c.fillRect(-4.8, -3.4, 10, 2.8);
  poly(c, [[-1.6, -3.8], [1.8, -3.8], [1.8, -0.2], [-1.6, -0.2]], LP.gold, LP.goldD, 0.4);
  c.fillStyle = LP.band; c.fillRect(-0.6, -3, 1.6, 2.2);
  // клевер на ленте
  c.fillStyle = '#7ae070'; for (const [dx, dy] of [[-3.6, -2.4], [-3.6, -1.2], [-2.8, -1.8]]) c.fillRect(dx, dy, 0.8, 0.8);
  c.restore();
  c.restore();
  // ближняя рука
  const nh = P.rh;
  const na = armTo(sh.near, nh, false);
  lepLimb(c, sh.near, na.e, na.b, 3, 2.6, k(LP.coat), k(LP.coat));
  c.fillStyle = k(LP.shirt); c.fillRect(na.b[0] - 1.6, na.b[1] - 1.2, 3.2, 2.4);       // манжета
  ellipse(c, na.b[0], na.b[1] + (P.ep === 'cheek' ? -0.4 : 0), 1.6, 1.6, k(LP.skin));
  // слиток в руках
  if (P.ingot === 1) lepIngot(c, na.b[0] + 1.6, na.b[1] - 0.2, -0.3, 0.9);
  if (P.ingot === 2) lepIngot(c, na.b[0] + 1.4, na.b[1] - 2.6, -0.4, 1.0);
  c.restore();
  // искры: щелчок каблуков, звёздочки, золотая россыпь
  if (P.click) { c.fillStyle = '#fff6b0'; for (const [dx, dy] of [[-3, -3], [3, -3.6], [0, -5.6], [-5, -5], [5, -6]]) c.fillRect(P.x + dx, dy, 1, 1); }
  if (P.stars) { c.fillStyle = '#fff6a0'; for (const [dx, dy, s] of [[9, -30, 1.4], [14, -26, 1], [5, -35, 1], [12, -34, 1.2]]) { c.fillRect(P.x + dx - s / 2, dy, s, s); c.fillRect(P.x + dx, dy - s / 2, 0.6, s * 2); } }
}

// ---------- кадр → спрайт ----------

const LEP_SPEC = { w: 84, h: 88, ax: 42, ay: 70, sc: 0.7 };
const lepCache = new Map();
function lepFrame(fr) {
  let s = lepCache.get(fr);
  if (s) return s;
  const S = LEP_SPEC, [cv, c] = mkSprite(S.w, S.h, 3);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const P = lepPose(fr);
  c.save();
  c.translate(S.ax, S.ay); c.scale(S.sc, S.sc);
  drawLep(c, P);
  c.restore();
  const out = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 });
  if (P.fade > 0) {       // растворение: пиксели пропадают «дизером», остальные зеленеют и бледнеют
    const oc = out.getContext('2d'), img = oc.getImageData(0, 0, out.width, out.height), d = img.data;
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
      const o = (y * out.width + x) * 4;
      if (!d[o + 3]) continue;
      if (naHash(x, y) < P.fade) d[o + 3] = 0;
      else { d[o] = d[o] + (150 - d[o]) * P.fade * 0.5; d[o + 1] = d[o + 1] + (255 - d[o + 1]) * P.fade * 0.5; d[o + 2] = d[o + 2] + (170 - d[o + 2]) * P.fade * 0.5; }
    }
    oc.putImageData(img, 0, 0);
  }
  s = { cv: out, ax: S.ax, ay: S.ay, w: S.w, h: S.h };
  lepCache.set(fr, s);
  return s;
}

// ---------- горшок с золотом ----------
// potB — задняя стенка с горкой монет, potF — передняя стенка и ободок; лепрекон «ныряет» между слоями
const LEP_POT = { w: 56, h: 48, ax: 28, ay: 40 };
const lepPotCache = new Map();
function lepPotSprite(layer) {
  let s = lepPotCache.get(layer);
  if (s) return s;
  const S = LEP_POT, [cv, c] = mkSprite(S.w, S.h, 3);
  c.translate(S.ax, S.ay);
  if (layer === 'B') {
    ellipse(c, 0, -17, 12.4, 4.6, '#0e0c0a');                       // чёрное нутро
    for (const [x, y, r] of [[-7, -19, 3], [-2, -21.5, 3.4], [4, -20.5, 3.2], [8, -18.5, 2.6], [-9, -17.5, 2.4], [0, -18, 3]]) {   // горка монет
      ellipse(c, x, y, r, r * 0.86, LP.gold); ellipse(c, x - 0.5, y - 0.6, r * 0.6, r * 0.5, LP.goldL);
      c.strokeStyle = LP.goldD; c.lineWidth = 0.5; c.beginPath(); c.ellipse(x, y, r, r * 0.86, 0, 0, 7); c.stroke();
    }
  } else {
    // ножки
    for (const sx of [-1, 1]) poly(c, [[sx * 9, -4], [sx * 11.4, 0.4], [sx * 8, 0.4], [sx * 6.4, -4]], '#16120e');
    // пузатое тело
    poly(c, [[-12.6, -17], [12.6, -17], [14, -11], [11, -3], [6, -0.6], [-6, -0.6], [-11, -3], [-14, -11]], '#2a2622');
    poly(c, [[-12.6, -17], [-7, -17], [-8.6, -1], [-11, -3], [-14, -11]], '#14110e');
    poly(c, [[6, -17], [12.6, -17], [14, -11], [11, -3], [8, -1.4]], '#4a443c');
    c.fillStyle = '#6a645a'; c.fillRect(7.6, -14, 1.2, 6);                   // блик
    // ободок
    c.strokeStyle = '#4a443c'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, -17, 12.6, 4.6, 0, 0.1, Math.PI - 0.1); c.stroke();
    // ручки
    c.strokeStyle = '#2a2622'; c.lineWidth = 1.4; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * 14.4, -14, 2.6, sx > 0 ? -1.6 : 1.5, sx > 0 ? 1.6 : 4.7, sx < 0); c.stroke(); }
    // монеты через край спереди
    for (const [x, y, r] of [[-5, -16.4, 2.1], [1, -17.4, 2.4], [6, -16.4, 2]]) { ellipse(c, x, y, r, r * 0.8, LP.gold); ellipse(c, x - 0.4, y - 0.5, r * 0.55, r * 0.4, LP.goldL); }
  }
  const out = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 });
  s = { cv: out, ax: S.ax, ay: S.ay, w: S.w, h: S.h };
  lepPotCache.set(layer, s);
  return s;
}

// радуга: семь цветных полос по дуге от горшка вверх и вправо; prog — как далеко «выросла» (0…1), fade — прозрачность
const LEP_RAINBOW = ['#ff4a4a', '#ff9a3a', '#ffe84a', '#5ad84a', '#4ab4ff', '#5a5aff', '#b05aff'];
function lepDrawRainbow(c, x, y, face, prog, alpha) {
  if (prog <= 0 || alpha <= 0) return;
  const R = 46, cx = x + face * R * 0.95, cy = y - 6;
  c.save();
  c.globalAlpha = alpha * 0.85;
  c.lineCap = 'butt';
  const a0 = face > 0 ? Math.PI : 0, span = Math.PI * 0.9 * Math.min(1, prog);
  for (let i = 0; i < LEP_RAINBOW.length; i++) {
    c.strokeStyle = LEP_RAINBOW[i]; c.lineWidth = 1.7;
    c.beginPath();
    if (face > 0) c.arc(cx, cy, R - i * 1.5, a0, a0 + span); else c.arc(cx, cy, R - i * 1.5, a0 - span, a0, false);
    c.stroke();
  }
  // перелив в конце дуги: блёстки
  c.fillStyle = '#ffffff'; c.globalAlpha = alpha * 0.7;
  const ea = face > 0 ? a0 + span : a0 - span;
  for (let j = 0; j < 4; j++) c.fillRect(Math.round(cx + Math.cos(ea) * (R - 5 - j * 2.6)), Math.round(cy + Math.sin(ea) * (R - 5 - j * 2.6)), 1, 1);
  c.restore();
}
