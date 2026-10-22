'use strict';
// Знать гоблинов (свой процедурный пиксель-арт, кадры — общая таблица поз naPose, как у гоблинов леса в neutralart2.js):
//  • goblinChamp — чемпион гоблинов: ростом почти с тролля, горбатый громила в лоскутной броне, с круглым щитом
//    из дверцы бочки и ржавым зазубренным мечом;
//  • goblinKing — король гоблинов (обычный, для лесных лагерей): толстый, в короне из жести, в плаще из мешковины,
//    с дубинкой-скипетром.
// Отдельный, нарядный король кампании (Шнырь Пороховой) — js/campaign/art.js.

// Тело гоблина в своих единицах (рост ≈ 24): o.k — тон с учётом удара, o.big — толщина, o.cloth/o.cloth2 — одежда
function gobBody(c, P, o) {
  const k = o.k, SK = k(o.skin || '#7aa848'), SK2 = k(o.skin2 || '#567e32'), CL = k(o.cloth), CL2 = k(o.cloth2), B = o.big || 1;
  const sw = P.leg;
  naLimb(c, -1.6 * B, -8, -2.2 * B - sw * 2.4, -0.8, 1.6 * B, SK2); naLimb(c, 1.6 * B, -8, 2.2 * B + sw * 2.4, -0.8, 1.7 * B, SK);
  ellipse(c, -1.8 * B - sw * 2.4, -0.6, 2 * B, 0.8, k('#3a2a1a')); ellipse(c, 3 * B + sw * 2.4, -0.6, 2.1 * B, 0.8, k('#3a2a1a'));
  // туловище: пузо и горб
  ellipse(c, 0, -12, 5 * B, 5.4, CL2);
  ellipse(c, 0.6, -11.6, 4.4 * B, 4.8, CL);
  ellipse(c, -2.4 * B, -15, 2.6 * B, 2.2, CL2);                                              // горб
  return { SK, SK2, CL, CL2 };
}
function gobHead(c, P, k, hx, hy, SK, SK2, s = 1) {
  poly(c, [[hx - 2.4 * s, hy - 0.6], [hx - 9 * s, hy - 4 - (P.eye === 1 ? 1 : 0)], [hx - 2.6 * s, hy + 1.4]], SK2);   // ухо
  ellipse(c, hx, hy, 3.6 * s, 3.3 * s, SK);
  ellipse(c, hx - 1 * s, hy + 0.5, 2.1 * s, 2.7 * s, SK2);
  poly(c, [[hx + 2 * s, hy - 0.6], [hx + 7.4 * s, hy + 1.8], [hx + 2.2 * s, hy + 1.6]], SK);                    // нос
  ellipse(c, hx + 1.4 * s, hy - 0.6, 1.05, 0.95, P.eye >= 2 ? SK2 : '#ffe040');
  if (P.eye < 2) { c.fillStyle = '#1a0f0a'; c.fillRect(hx + 1.6 * s, hy - 1, 0.65, 0.85); } else naEye(c, hx + 1.4 * s, hy - 0.6, P);
  if (P.mouth > 0.3) { c.fillStyle = '#4a1a1a'; c.fillRect(hx + 0.6, hy + 1.8 * s, 2.8 * s, 0.6 + P.mouth); c.fillStyle = '#fff'; c.fillRect(hx + 1, hy + 1.8 * s, 0.6, 0.7); c.fillRect(hx + 2.6 * s, hy + 1.8 * s, 0.6, 0.7); }
  else { c.fillStyle = '#2a1a0a'; c.fillRect(hx + 0.8, hy + 1.8 * s, 2.2 * s, 0.5); }
}

// =============== Чемпион гоблинов ===============
function drawGoblinChamp(c, P) {
  const k = col => naK(P, col);
  naShadow(c, 9);
  c.save();
  c.translate(P.x, P.y); c.rotate(P.rot); c.scale(1, P.sq);
  // дальняя рука со щитом (щит — дверца бочки с ободом и заклёпками)
  const sh = P.b > 0.5 ? 1 : 0;
  const [sx, sy] = naArm(c, -3, -15, 3.6, 3.2, 0.5 + sh * 0.9, 0.6, 1.8, k('#567e32'));
  const { SK, SK2 } = gobBody(c, P, { k, big: 1.25, skin: '#6e9a40', skin2: '#4e7228', cloth: '#6a5a4a', cloth2: '#4a3e34' });
  // лоскутная броня: пластины и ремни
  poly(c, [[-4.6, -15.6], [4.6, -15.6], [5.4, -10], [-5, -9.6]], k('#7c7468'));
  c.fillStyle = k('#5a544c'); c.fillRect(-4.8, -13, 10, 0.9); c.fillRect(-4.6, -10.8, 9.6, 0.8);
  c.fillStyle = k('#a89c88'); c.fillRect(-3, -15, 1, 1); c.fillRect(1.6, -14.6, 1, 1); c.fillRect(3.4, -11.6, 1, 1);
  naLimb(c, -4, -16, 3.6, -9.4, 0.9, k('#3a2a1a'));                                                      // перевязь
  poly(c, [[-5.6, -16.4], [-2.4, -18], [-1.8, -15.2], [-5, -14.4]], k('#8a8278'));                       // наплечник
  // голова в рогатом шлеме-котелке
  const hx = 2 + (P.a > 0.5 ? 1 : 0), hy = -20 + (P.hurt > 0.5 ? 0.6 : 0);
  gobHead(c, P, k, hx, hy, SK, SK2, 1.1);
  poly(c, [[hx - 4.2, hy - 1], [hx - 3.4, hy - 4.8], [hx + 3.4, hy - 5], [hx + 4.2, hy - 1]], k('#6a6460'));
  c.fillStyle = k('#4a4440'); c.fillRect(hx - 4.4, hy - 1.6, 8.8, 1);
  poly(c, [[hx - 3, hy - 4.4], [hx - 5.6, hy - 8.4], [hx - 2, hy - 4.8]], k('#e8dcc0'));                  // рога
  poly(c, [[hx + 2.6, hy - 4.6], [hx + 4.6, hy - 8.8], [hx + 3.6, hy - 4.4]], k('#e8dcc0'));
  // щит поверх дальней руки
  ellipse(c, sx + 1, sy - 1, 4.6, 5.2, k('#6a4424'));
  ellipse(c, sx + 1, sy - 1, 3.6, 4.2, k('#845a30'));
  c.strokeStyle = k('#5a5a62'); c.lineWidth = 0.8; c.beginPath(); c.ellipse(sx + 1, sy - 1, 4.4, 5, 0, 0, 7); c.stroke();
  c.fillStyle = k('#3a2a1a'); c.fillRect(sx - 3, sy - 1.4, 8, 0.8);
  c.fillStyle = k('#b0b0b8'); c.fillRect(sx + 0.5, sy - 1.6, 1.2, 1.2);
  // ближняя рука с ржавым зазубренным мечом
  const th = naTheta(P);
  const [ax, ay, ang] = naArm(c, 2.6, -15, 4, 3.8, th, -0.4, 1.9, SK);
  const [dx, dy] = naDir(ang + 0.15);
  const L = 13;
  poly(c, [[ax - dy * 1.3, ay + dx * 1.3], [ax + dx * L - dy * 0.9, ay + dy * L + dx * 0.9], [ax + dx * (L + 2.4), ay + dy * (L + 2.4)], [ax + dx * L + dy * 1.1, ay + dy * L - dx * 1.1], [ax + dy * 1.3, ay - dx * 1.3]], k('#8a6a50'));
  for (let i = 3; i < L; i += 2.6) { const px = ax + dx * i + dy * 1.2, py = ay + dy * i - dx * 1.2; poly(c, [[px, py], [px + dx * 1.2 + dy * 1, py + dy * 1.2 - dx * 1], [px + dx * 2.2, py + dy * 2.2]], k('#6a4a34')); }   // зубья
  c.fillStyle = k('#b0583a'); c.fillRect(ax + dx * 6 - 0.6, ay + dy * 6 - 0.6, 1.4, 1.2); c.fillRect(ax + dx * 9.6, ay + dy * 9.6, 1.2, 1); // ржавчина
  naLimb(c, ax - dy * 2.4, ay + dx * 2.4, ax + dy * 2.4, ay - dx * 2.4, 1.2, k('#4a4440'));                // гарда
  if (P.a > 0.6) { c.strokeStyle = 'rgba(255,240,220,0.7)'; c.lineWidth = 0.6; c.beginPath(); c.arc(ax, ay, 13, ang - 1.2, ang - 0.2); c.stroke(); }
  c.restore();
}

// =============== Король гоблинов (обычный) ===============
function drawGoblinKing(c, P) {
  const k = col => naK(P, col);
  naShadow(c, 8);
  c.save();
  c.translate(P.x, P.y); c.rotate(P.rot); c.scale(1, P.sq);
  // плащ из мешковины за спиной
  poly(c, [[-4, -17], [3, -17], [5, -2], [-7, -1.4], [-6, -9]], k('#8a7450'));
  poly(c, [[-4, -17], [-1, -17], [-3, -1.6], [-7, -1.4], [-6, -9]], k('#6a5638'));
  naArm(c, -3, -14, 3.6, 3.2, P.up > 0.5 ? -2.7 : 0.4, 0.4, 1.3, k('#567e32'));
  const { SK, SK2 } = gobBody(c, P, { k, big: 1.15, cloth: '#7a3a3a', cloth2: '#5a2828' });
  c.fillStyle = k('#c8a040'); c.fillRect(-4.8, -10.6, 10, 1);                                           // золочёный пояс
  ellipse(c, 0.8, -10.1, 1.1, 1, k('#e04a3a'));
  const hx = 1.8 + (P.a > 0.5 ? 1 : 0), hy = -19.4 + (P.hurt > 0.5 ? 0.6 : 0);
  gobHead(c, P, k, hx, hy, SK, SK2, 1.05);
  // корона из жести: кривые зубцы
  poly(c, [[hx - 3.4, hy - 2.6], [hx - 3.8, hy - 6.4], [hx - 2, hy - 4.4], [hx - 0.6, hy - 7], [hx + 0.8, hy - 4.4], [hx + 2.4, hy - 6.6], [hx + 3.4, hy - 2.6]], k('#b8b0a0'));
  c.fillStyle = k('#8a8478'); c.fillRect(hx - 3.6, hy - 3.2, 7, 0.9);
  // дубинка-скипетр с гвоздями
  const th = naTheta(P);
  const [ax, ay, ang] = naArm(c, 2.2, -14.4, 3.8, 3.6, th, -0.4, 1.4, SK);
  const [dx, dy] = naDir(ang + 0.15);
  naLimb(c, ax - dx * 2, ay - dy * 2, ax + dx * 8, ay + dy * 8, 1.4, k('#6a4a2a'));
  ellipse(c, ax + dx * 9, ay + dy * 9, 2.4, 2.4, k('#7a5a34'));
  c.fillStyle = k('#c0c0c8'); c.fillRect(ax + dx * 9 + 1.6, ay + dy * 9 - 0.4, 1.2, 0.8); c.fillRect(ax + dx * 9 - 2.8, ay + dy * 9, 1.2, 0.8);
  if (P.a > 0.6) { c.strokeStyle = 'rgba(255,255,230,0.7)'; c.lineWidth = 0.5; c.beginPath(); c.arc(ax, ay, 10, ang - 1.2, ang - 0.2); c.stroke(); }
  c.restore();
}

if (typeof NA_SPEC !== 'undefined') {
  NA_SPEC.goblinChamp = { name: 'Чемпион гоблинов', w: 132, h: 118, ax: 62, ay: 104, sc: 2.3 };
  NA_SPEC.goblinKing = { name: 'Король гоблинов', w: 84, h: 78, ax: 40, ay: 66, sc: 1.6 };
  NA_DRAW.goblinChamp = drawGoblinChamp;
  NA_DRAW.goblinKing = drawGoblinKing;
}
