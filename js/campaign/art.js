'use strict';
// Графика только для кампании (КАМПАНИЯ.md §7, свой процедурный пиксель-арт):
//  • shnyrKing — Шнырь Пороховой, король гоблинов-подрывников: нарядней лесного короля (goblinart.js) —
//    корона с самоцветами поверх латунных очков подрывника, бархатный плащ с горностаевой оторочкой,
//    золотая цепь с медальоном-бомбой, пояс с пороховницами и скипетр с бомбой на конце (фитиль искрит);
//  • Тан Борода Старший — старейшина Подгорья: борода до колен, золотой обруч, синяя мантия, посох с фонарём;
//  • Пим Чернилкин — летописец: зелёные пальцы от чернил, книга под мышкой, перо за ухом;
//  • бойцы Шныря в волнах: гоблины, гоблины с копьецом и чемпион гоблинов (goblinart.js).

function drawShnyrKing(c, P) {
  const k = col => naK(P, col);
  naShadow(c, 8);
  c.save();
  c.translate(P.x, P.y); c.rotate(P.rot); c.scale(1, P.sq);
  // плащ: бархат, горностаевая оторочка с чёрными хвостиками
  const sway = Math.sin((P.leg || 0) * 2) * 0.8;
  poly(c, [[-4.4, -18], [3.6, -18], [5.4, -1], [-8 - sway, -0.6], [-7, -10]], k('#8a1a2a'));
  poly(c, [[-4.4, -18], [-1.4, -18], [-3.4, -0.8], [-8 - sway, -0.6], [-7, -10]], k('#5e0e1c'));
  poly(c, [[-8.4 - sway, -2.2], [5.6, -2.6], [5.4, -0.4], [-8.2 - sway, 0]], k('#f2eee4'));
  c.fillStyle = k('#1a1414'); for (const x of [-6, -2.6, 0.8, 3.8]) c.fillRect(x - sway * 0.5, -1.8, 0.8, 1.2);
  naArm(c, -3, -14.4, 3.6, 3.2, P.up > 0.5 ? -2.7 : 0.4, 0.4, 1.3, k('#4e7a2c'));
  const { SK, SK2 } = gobBody(c, P, { k, big: 1.12, skin: '#82b44c', skin2: '#5a8634', cloth: '#5a2a7a', cloth2: '#3e1a58' });
  // золотое шитьё на кафтане, пояс с пороховницами
  c.strokeStyle = k('#e8c050'); c.lineWidth = 0.5; c.beginPath(); c.moveTo(-3, -15.6); c.lineTo(0.6, -12.4); c.lineTo(4, -15.4); c.stroke();
  c.fillStyle = k('#3a2414'); c.fillRect(-5, -10.6, 10.4, 1.2);
  c.fillStyle = k('#f0c848'); c.fillRect(0, -10.8, 1.6, 1.6);
  ellipse(c, -3.4, -8.8, 1.2, 1.5, k('#6a4424')); ellipse(c, 3.6, -8.8, 1.2, 1.5, k('#6a4424'));
  // цепь с медальоном-бомбой
  c.strokeStyle = k('#f0c848'); c.lineWidth = 0.6; c.beginPath(); c.arc(0.8, -16.4, 3.4, 0.3, Math.PI - 0.3); c.stroke();
  ellipse(c, 0.8, -12.6, 1.5, 1.5, k('#f0c848')); ellipse(c, 0.8, -12.6, 0.9, 0.9, k('#2a2a30'));
  // голова, серьги-кольца, латунные очки на лбу и корона
  const hx = 1.8 + (P.a > 0.5 ? 1 : 0), hy = -20 + (P.hurt > 0.5 ? 0.6 : 0);
  gobHead(c, P, k, hx, hy, SK, SK2, 1.08);
  c.strokeStyle = k('#f0c848'); c.lineWidth = 0.55; c.beginPath(); c.arc(hx - 7, hy - 1.6, 1, 0, 7); c.stroke();
  ellipse(c, hx - 0.8, hy - 2.6, 1.4, 1.1, k('#b08040')); ellipse(c, hx + 2.2, hy - 2.6, 1.4, 1.1, k('#b08040'));
  ellipse(c, hx - 0.8, hy - 2.6, 0.8, 0.6, k('#9ad8e8')); ellipse(c, hx + 2.2, hy - 2.6, 0.8, 0.6, k('#9ad8e8'));
  poly(c, [[hx - 3.6, hy - 3.4], [hx - 4.4, hy - 8], [hx - 2.2, hy - 5.4], [hx - 0.8, hy - 8.8], [hx + 0.8, hy - 5.4], [hx + 2.6, hy - 8.6], [hx + 3.4, hy - 5.2], [hx + 4.8, hy - 7.6], [hx + 4, hy - 3.4]], k('#f0c848'));
  c.fillStyle = k('#c89a28'); c.fillRect(hx - 3.8, hy - 4.2, 8, 1);
  ellipse(c, hx - 0.8, hy - 6, 0.8, 0.8, k('#e03a4a')); ellipse(c, hx + 2.6, hy - 5.8, 0.7, 0.7, k('#3ac87a')); ellipse(c, hx - 4.2, hy - 7.4, 0.6, 0.6, k('#fff6c8'));
  // скипетр: золотой жезл, на конце бомба с фитилём
  const th = naTheta(P);
  const [ax, ay, ang] = naArm(c, 2.2, -14.6, 3.8, 3.6, th, -0.4, 1.4, SK);
  const [dx, dy] = naDir(ang + 0.15);
  naLimb(c, ax - dx * 3, ay - dy * 3, ax + dx * 9, ay + dy * 9, 1.1, k('#e0b840'));
  ellipse(c, ax + dx * 11, ay + dy * 11, 2.8, 2.8, k('#2a2a32'));
  ellipse(c, ax + dx * 11 - 0.8, ay + dy * 11 - 0.9, 0.9, 0.8, k('#6a6a78'));
  naLimb(c, ax + dx * 12.6, ay + dy * 12.6, ax + dx * 14.2 + 1, ay + dy * 14.2 - 1, 0.5, k('#8a6a40'));
  c.fillStyle = '#fff2a0'; c.fillRect(ax + dx * 14.4 + 1, ay + dy * 14.4 - 1.6, 1, 1);
  if (P.a > 0.6) { c.strokeStyle = 'rgba(255,240,200,0.7)'; c.lineWidth = 0.5; c.beginPath(); c.arc(ax, ay, 12, ang - 1.2, ang - 0.2); c.stroke(); }
  c.restore();
}
if (typeof NA_SPEC !== 'undefined') {
  NA_SPEC.shnyrKing = { name: 'Шнырь Пороховой, король гоблинов', w: 96, h: 96, ax: 46, ay: 80, sc: 1.85 };
  NA_DRAW.shnyrKing = drawShnyrKing;
}

// ---------- Жители Подгорья (статичные фигуры у мест сцен; дышат и моргают) ----------

const CAMP_NPC_SPR = {};
function campNpcSprite(kind, f) {
  const key = kind + f;
  if (CAMP_NPC_SPR[key]) return CAMP_NPC_SPR[key];
  const [cv, c] = mkSprite(40, 48, 3);
  c.translate(20, 44);
  c.scale(1, 1 - f * 0.02);
  if (kind === 'tan') campDrawTan(c, f); else campDrawPim(c, f);
  return (CAMP_NPC_SPR[key] = toPixelArt(cv, 3, { outline: true, outlineDark: 0.3, alphaCut: 100 }));
}
function campDrawTan(c, f) {
  c.fillStyle = 'rgba(10,8,4,0.32)'; c.beginPath(); c.ellipse(0, 0, 9, 2.5, 0, 0, 7); c.fill();
  naLimb(c, 10, -32, 10, 0, 1.4, '#6a4a2a');                                       // посох
  c.fillStyle = '#3a2a1a'; c.fillRect(8, -36, 5, 4); c.fillStyle = '#ffd870'; c.fillRect(9, -35, 3, 2);
  poly(c, [[-8, -24], [8, -24], [10, 0], [-10, 0]], '#2a4a8a');                     // мантия
  poly(c, [[-8, -24], [-2, -24], [-4, 0], [-10, 0]], '#1c3466');
  c.fillStyle = '#e8c050'; c.fillRect(-10, -2, 20, 1.2);
  ellipse(c, 0, -28, 6, 5.6, '#e8b890');                                            // лицо
  poly(c, [[-6, -27], [6, -27], [5, -14], [2, -4], [0, -2], [-2, -4], [-5, -14]], '#f2eee4');   // борода до колен
  poly(c, [[-2, -18], [2, -18], [1, -6], [0, -4], [-1, -6]], '#d8d2c4');
  ellipse(c, -2.2, -29, 0.9, f === 1 ? 0.2 : 0.8, '#1a0f0a'); ellipse(c, 2.2, -29, 0.9, f === 1 ? 0.2 : 0.8, '#1a0f0a');
  ellipse(c, 0, -27.2, 1.4, 1, '#d89a70');                                            // нос
  c.fillStyle = '#f0c848'; c.fillRect(-6, -33.4, 12, 1.6);                           // обруч
  ellipse(c, 0, -33, 1, 1, '#e03a4a');
  naLimb(c, 6, -20, 10, -16, 2.4, '#2a4a8a');                                         // рука к посоху
}
function campDrawPim(c, f) {
  c.fillStyle = 'rgba(10,8,4,0.32)'; c.beginPath(); c.ellipse(0, 0, 8, 2.2, 0, 0, 7); c.fill();
  naLimb(c, -2, -8, -3, 0, 2, '#3a3a40'); naLimb(c, 2, -8, 3, 0, 2, '#3a3a40');
  poly(c, [[-6, -22], [6, -22], [7, -7], [-7, -7]], '#3a5a4a');                     // камзол
  c.fillStyle = '#2a4034'; c.fillRect(-7, -9, 14, 1.4);
  poly(c, [[6, -18], [12, -16], [11, -10], [5, -12]], '#6a2a1a');                    // книга
  c.fillStyle = '#f2e8d0'; c.fillRect(6, -15.6, 5, 0.8);
  ellipse(c, 0, -26, 5.4, 5, '#e8c0a0');
  poly(c, [[-5.4, -27], [-4, -31], [3, -31.6], [5.6, -27.6], [3, -29.4], [-3, -29]], '#5a3a24');   // волосы
  poly(c, [[-4, -22.6], [4, -22.6], [2.6, -18], [0, -17], [-2.6, -18]], '#7a5a3a');   // бородка
  ellipse(c, -1.8, -26.6, 0.8, f === 1 ? 0.2 : 0.75, '#1a0f0a'); ellipse(c, 2, -26.6, 0.8, f === 1 ? 0.2 : 0.75, '#1a0f0a');
  naLimb(c, 4.6, -30, 8, -36, 0.7, '#f2eee4');                                         // перо за ухом
  c.fillStyle = '#3ac87a'; c.fillRect(-7.4, -12, 2, 2); c.fillRect(6.8, -12.6, 1.6, 1.6);   // зелёные пальцы
}
function campDrawNpc(c, kind, x, y) {
  const t = Game.time, f = (t * 0.5 + x) % 6 < 0.15 ? 1 : 0;
  const s = campNpcSprite(kind, f), bob = Math.sin(t * 1.6 + x) > 0.6 ? -1 : 0;
  c.drawImage(s, Math.round(x * TILE + 16 - 20), Math.round(y * TILE + 26 - 44 + bob));
}
