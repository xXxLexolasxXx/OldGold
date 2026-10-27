'use strict';
// Листы выбора: строка на существо, столбцы A (как в игре) / B ×2 / C ×3 / D ×4, в каждом — покой и атака/движение.
// Каждая запись: [имя, g, () => кадр покоя, () => кадр действия, сглаживать ли A (векторные 3×)].

// Существо, которое игра рисует прямо на холст (без спрайта): рисуем в 12× и дальше как векторное.
function pxsRt(w, h, ax, ay, draw) {
  const cv = mkCanvas(w * 12, h * 12), c = cv.getContext('2d', { willReadFrequently: true });
  c.scale(12, 12); c.translate(ax, ay); draw(c);
  return cv;
}
const pxsCv = r => (r && r.cv) || r;
const pxsBudget = () => { R.sprMs = 0; R.newSprites = 0; };

const PXS_SHEETS = {
  undead: ['Нежить', [
    ['Призрак', 3, () => ghostSprite('idle', 0), () => ghostSprite('atk', 4), true, { vec: true, cut: 60 }],
    ['Жнец', 3, () => reaperSprite('idle', 0, 0), () => reaperSprite('atk', 4, 0), true, { vec: true, cut: 60 }],
    ['Баньши', 3, () => fzBansheeSprite(0, 0), () => fzBansheeSprite(2, 3), false],
    ['Скелет', 2, () => (pxsBudget(), skelSprite({ hx: 3, hy: 5 }, 'E', 'idle', 0).cv), () => (pxsBudget(), skelSprite({ hx: 3, hy: 5 }, 'E', 'atk', 4).cv)],
    ['Курганный князь', 2, () => (pxsBudget(), kpSprite('i0', 1).cv), () => (pxsBudget(), kpSprite('strike', 1).cv)],
    ['Призрачный волк', 3, () => fzWolfSprite(0, false), () => fzWolfSprite(1, 2), true, { vec: true, cut: 60 }],
    ['Полудница', 3, () => fzNoonSprite(0), () => fzNoonSprite(3), true, { vec: true, cut: 120 }],
    ['Призрак павшего', 1, () => ecSprite(ecLook({ k: 'hero', c: 'warrior' }), 'hov', 0), () => ecSprite(ecLook({ k: 'hero', c: 'warrior' }), 'atk', 5)],
    ['Летучие мыши', 12, () => pxsRt(24, 24, 12, 18, c => { Game.bats = [{ x: 0, y: 0, z: 8, ph: 0.3, state: 'fly' }]; drawBats(c); }),
      () => pxsRt(24, 24, 12, 18, c => { Game.bats = [{ x: 0, y: 0, z: 8, ph: 1.6, state: 'fly' }]; drawBats(c); }), false, { vec: true }],
  ]],
  dark: ['Малгор и его слуги', [
    ['Тёмный маг Малгор', 12, () => pxsRt(40, 60, 18, 56, c => { Game.time = 0; foeDrawMalgor(c, { phase: 1 }); }), () => pxsRt(40, 60, 18, 56, c => { Game.time = 0; foeDrawMalgor(c, { phase: 1, castT: 1 }); }), false, { vec: true }],
    ['Рыцарь тьмы', 12, () => pxsRt(44, 48, 20, 44, c => foeDrawKnight(c, { st: 'idle', ph: 0 })), () => pxsRt(44, 48, 20, 44, c => foeDrawKnight(c, { st: 'atk', atkT: 0.3, ph: 0 })), false, { vec: true }],
    ['Прислужник тьмы', 12, () => pxsRt(36, 40, 16, 36, c => foeDrawThrall(c, { st: 'idle', ph: 0 }, true)), () => pxsRt(36, 40, 16, 36, c => foeDrawThrall(c, { st: 'atk', atkT: 0.3, ph: 0 }, true)), false, { vec: true }],
    ['Ворон-разведчик', 12, () => pxsRt(20, 30, 8, 28, c => foeDrawRaven(c, { ph: 0 })), () => pxsRt(20, 30, 8, 28, c => foeDrawRaven(c, { ph: 1 })), false, { vec: true }],
    ['Костяной прислужник', 12, () => pxsRt(24, 26, 12, 22, c => { Game.time = 0; gdDrawBone(c, { id: 1, st: 'idle', ph: 0 }); }), () => pxsRt(24, 26, 12, 22, c => { Game.time = 0; gdDrawBone(c, { id: 1, st: 'atk', atkT: 0.2, ph: 0 }); }), false, { vec: true }],
    ...['fire', 'ice', 'bone', 'shadow', 'golem'].map(k => [GD_KINDS[k].name, 12,
      () => pxsRt(60, 64, 30, 58, c => { Game.time = 0; gdDrawGuard(c, { gk: k, id: 1, st: 'idle', ph: 0 }); }),
      () => pxsRt(60, 64, 30, 58, c => { Game.time = 0; gdDrawGuard(c, { gk: k, id: 1, st: 'atk', atkT: 0.25, ph: 0 }); }), false, { vec: true }]),
  ]],
  forest: ['Лесные', [
    ['Ходячее дерево (дуб)', 1, () => entSprite('oak', 'idle').cv, () => entSprite('oak', 'f1').cv],
    ['Ходячее дерево (ель)', 1, () => entSprite('fir', 'idle').cv, () => entSprite('fir', 'w1').cv],
    ['Леший', 1, () => naFrame('leshy', 'i0').cv, () => naFrame('leshy', 'strike').cv],
    ['Кабан-страж', 1, () => naFrame('boar', 'i0').cv, () => naFrame('boar', 'strike').cv],
    ['Чумной моховик', 1, () => naFrame('spore', 'i0').cv, () => naFrame('spore', 'strike').cv],
    ['Лесная фея', 1, () => naFrame('fairy', 'i0').cv, () => naFrame('fairy', 'c3').cv],
    ['Цветочная фея', 1, () => naFrame('pixie', 'i0').cv, () => naFrame('pixie', 'c3').cv],
    ['Лепрекон', 1, () => lepFrame('i0').cv, () => lepFrame('x0').cv],
    ['Ледяной элементаль', 1, () => naFrame('frost', 'i0').cv, () => naFrame('frost', 'strike').cv],
    ['Кабан', 1, () => beSpr('boarA', BOAR_A), () => beSpr('boarW2', gaitRows(BOAR_A, 2, 8, 2))],
    ['Медведь', 1, () => beSpr('bearA', BEAR_A), () => beSpr('bearW2', gaitRows(BEAR_A, 3, 8, 2))],
    ['Кикимора', 1, () => fzSprites().kikA, () => fzSprites().kikB],
    ['Мимик', 1, () => chSpr('m', 3), () => chSpr('a', 3, 1)],
  ]],
  frogs: ['Жаболюды и лесные народы', [
    ['Жаболюд-копейщик', 1, () => naFrame('ftG', 'i0').cv, () => naFrame('ftG', 'strike').cv],
    ['Жаболюд-охотник', 1, () => naFrame('ftB', 'i0').cv, () => naFrame('ftB', 't3').cv],
    ['Жаболюд-громовик', 1, () => naFrame('ftP', 'i0').cv, () => naFrame('ftP', 'c3').cv],
    ['Жаболюд-огнемаг', 1, () => naFrame('ftR', 'i0').cv, () => naFrame('ftR', 'c3').cv],
    ['Вождь жаболюдов', 1, () => naFrame('ftK', 'i0').cv, () => naFrame('ftK', 'strike').cv],
    ['Король жаболюдов', 1, () => naFrame('ftQ', 'i0').cv, () => naFrame('ftQ', 'strike').cv],
    ['Броненосец', 1, () => naFrame('armad', 'i0').cv, () => naFrame('armad', 'strike').cv],
    ['Гномтавр-копейщик', 1, () => naFrame('gtSpear', 'i0').cv, () => naFrame('gtSpear', 'strike').cv],
    ['Гномтавр-лучник', 1, () => naFrame('gtBow', 'i0').cv, () => naFrame('gtBow', 'strike').cv],
  ]],
  big: ['Гоблины, тролли и крупные', [
    ['Гоблин', 1, () => naFrame('goblin', 'i0').cv, () => naFrame('goblin', 'strike').cv],
    ['Гоблин с копьецом', 1, () => naFrame('goblinB', 'i0').cv, () => naFrame('goblinB', 'strike').cv],
    ['Чемпион гоблинов', 1, () => naFrame('goblinChamp', 'i0').cv, () => naFrame('goblinChamp', 'strike').cv],
    ['Шнырь, король гоблинов', 1, () => naFrame('shnyrKing', 'i0').cv, () => naFrame('shnyrKing', 'strike').cv],
    ['Лесной тролль', 1, () => naFrame('troll', 'i0').cv, () => naFrame('troll', 'strike').cv],
    ['Каменный тролль', 1, () => naFrame('trollS', 'i0').cv, () => naFrame('trollS', 'strike').cv],
    ['Болотный тролль', 1, () => naFrame('trollB', 'i0').cv, () => naFrame('trollB', 'strike').cv],
    ['Голем', 2, () => golemSprite('S', 'idle', 0, true), () => golemSprite('E', 'pound', 6, true)],
    ['Разбойник', 2, () => (pxsBudget(), wildSprite('brigand', 'E', 'idle', 0)), () => (pxsBudget(), wildSprite('brigand', 'E', 'fight', 'strike'))],
    ['Ожившая глыба', 12, () => pxsRt(24, 24, 12, 20, c => { Game.time = 0; camp2DrawRockling(c, { id: 1, st: 'idle' }); }), () => pxsRt(24, 24, 12, 20, c => { Game.time = 0; camp2DrawRockling(c, { id: 1, st: 'atk', atkT: 0.2 }); }), false, { vec: true }],
    ['Дракончик', 1, () => sprDragon(1), () => sprDragon(0)],
    ['Грифон', 1, () => sprGriffin(1), () => sprGriffin(0)],
    ['Эндермен', 1, () => sprEnder(0), () => sprEnder(1)],
  ]],
  sea: ['Морские (море ещё не выпущено)', [
    ['Краб', 1, () => seaSprite('crab', 'idle', 0).cv, () => seaSprite('crab', 'atk', 4).cv],
    ['Медуза', 1, () => seaSprite('jelly', 'swim', 0).cv, () => seaSprite('jelly', 'atk', 2).cv],
    ['Осьминог', 1, () => seaSprite('octo', 'idle', 0).cv, () => seaSprite('octo', 'atk', 2).cv],
    ['Морской змей', 1, () => seaSprite('serpent', 'swim', 0).cv, () => seaSprite('serpent', 'atk', 2).cv],
    ['Кракен: щупальце', 1, () => seaSprite('tent', 'idle', 0).cv, () => seaSprite('tent', 'atk', 2).cv],
    ['Кракен: глаз', 1, () => seaSprite('kraeye', 'idle', 0).cv, () => seaSprite('kraeye', 'idle', 2).cv],
    ['Чайка', 1, () => seaSprite('gull', 'idle', 0).cv, () => seaSprite('gull', 'atk', 1).cv],
    ['Русалка', 1, () => seaSprite('mermaid', 'sit', 0).cv, () => seaSprite('mermaid', 'dive', 1).cv],
    ['Водяной', 1, () => fzSprites().vodA, () => fzSprites().vodB],
  ]],
};

// Рамка непрозрачных пикселей кадра в игровых пикселях
function pxsBBox(cv, g) {
  // рамка без случайных искр: отбрасываем по 2% крайних непрозрачных пикселей с каждой стороны
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, xs = [], ys = [];
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 128) { xs.push(x); ys.push(y); }
  if (!xs.length) return null;
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
  const q = v => v[Math.min(v.length - 1, Math.floor(v.length * 0.02))], Q = v => v[Math.max(0, Math.ceil(v.length * 0.98) - 1)];
  const x0 = q(xs), x1 = Q(xs), y0 = q(ys), y1 = Q(ys);
  return { x: Math.floor(x0 / g), y: Math.floor(y0 / g), w: Math.ceil((x1 + 1) / g) - Math.floor(x0 / g), h: Math.ceil((y1 + 1) / g) - Math.floor(y0 / g) };
}

async function pxsRun(sheet) {
  Game.time = Game.time || 0; R.smooth = false;
  const [title, list] = PXS_SHEETS[sheet];
  const KS = [2, 3, 4], FW = 250, FH = 250, GAP = 10, LW = 210, COLW = 2 * FW + GAP + 26, ROWH = FH + 24, TOP = 150;
  const rows = [], miss = [];
  for (const [name, g, mkI, mkA, smooth, opt = {}] of list) {
    try {
      const I = pxsVariants(() => pxsCv(mkI()), g, KS, opt), A = pxsVariants(() => pxsCv(mkA()), g, KS, opt);
      rows.push({ name, g, smooth, own: I.src === 'own', fr: [I, A] });
    } catch (e) { miss.push(name + ': ' + e.message); console.warn('нет кадра', name, e.message); }
  }
  const cv = document.getElementById('cv');
  cv.width = LW + 4 * COLW + 10; cv.height = TOP + rows.length * ROWH + 70;
  const o = cv.getContext('2d');
  o.fillStyle = '#1d2e26'; o.fillRect(0, 0, cv.width, cv.height);
  o.fillStyle = '#e8f4ea'; o.font = 'bold 40px sans-serif';
  o.fillText('Нечисть — выбор пиксельного шаблона: «' + title + '»', 24, 52);
  o.font = '22px sans-serif'; o.fillStyle = '#b8d4c0';
  o.fillText('В каждой ячейке: слева покой, справа атака/движение. Размер существа одинаковый, пиксель в B/C/D в 2/3/4 раза МЕЛЬЧЕ, чем сейчас (больше деталей).', 24, 88);
  const HEAD = ['A — как сейчас в игре', 'B — пиксель мельче ×2', 'C — пиксель мельче ×3', 'D — пиксель мельче ×4'];
  o.font = 'bold 26px sans-serif';
  HEAD.forEach((h, i) => { o.fillStyle = ['#e8f4ea', '#ffd27a', '#9fe0ff', '#ffa0a0'][i]; o.fillText(h, LW + i * COLW + 8, TOP - 18); });
  rows.forEach((r, ri) => {
    const y0 = TOP + ri * ROWH;
    o.fillStyle = ri % 2 ? '#22362c' : '#1a2a22'; o.fillRect(0, y0, cv.width, ROWH);
    o.fillStyle = '#e8f4ea'; o.font = 'bold 23px sans-serif';
    const lines = []; let line = '';
    for (const w of r.name.split(' ')) { if ((line + ' ' + w).length > 15 && line) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w; }
    lines.push(line);
    lines.forEach((l, i) => o.fillText(l, 16, y0 + ROWH / 2 - 4 + i * 27 - (lines.length - 1) * 13));
    o.font = '17px sans-serif'; o.fillStyle = '#8fb09a'; o.fillText('№ ' + (ri + 1), 16, y0 + ROWH - 14);
    // общая рамка двух кадров (игровые пиксели), чтобы масштаб был один на строку
    const bb = r.fr.map(f => pxsBBox(f.A, r.g)).filter(Boolean);
    const bw = Math.max(...bb.map(b => b.w)), bh = Math.max(...bb.map(b => b.h));
    const Z = Math.max(1, Math.min(12, Math.floor(Math.min((FW - 10) / bw, (FH - 10) / bh))));
    r.fr.forEach((f, fi) => {
      const b = pxsBBox(f.A, r.g); if (!b) return;
      for (let vi = 0; vi < 4; vi++) {
        const cx = LW + vi * COLW + fi * (FW + GAP), cy = y0 + 12;
        o.fillStyle = '#2c4438'; o.fillRect(cx, cy, FW, FH);
        const ox = cx + Math.round((FW - b.w * Z) / 2) - b.x * Z, oy = cy + Math.round((FH - b.h * Z) / 2) - b.y * Z;
        o.save(); o.beginPath(); o.rect(cx, cy, FW, FH); o.clip();
        const v = vi ? f.v[KS[vi - 1]] : null;
        if (!v) {
          o.imageSmoothingEnabled = vi === 0 && !!r.smooth;
          if (vi) o.globalAlpha = 0.35;
          o.drawImage(f.A, ox, oy, f.A.width / r.g * Z, f.A.height / r.g * Z);
          o.globalAlpha = 1;
        } else {
          const k = KS[vi - 1]; o.imageSmoothingEnabled = false;
          o.drawImage(v, ox, oy, v.width / k * Z, v.height / k * Z);
        }
        o.restore();
        if (vi && !v && fi === 0) {
          o.fillStyle = '#ffe6a0'; o.font = 'bold 17px sans-serif';
          o.fillText('ручной пиксель-арт:', cx + 10, cy + FH - 34);
          o.fillText('мельче — перерисовкой', cx + 10, cy + FH - 12);
        }
      }
    });
  });
  o.font = '19px sans-serif'; o.fillStyle = '#8fb09a';
  o.fillText('Свои спрайты игры: B–D собраны тем же конвейером (toPixelArt, общая палитра игры), цветная обводка без чёрного. Это только примерка — в игре ничего не изменено.', 24, cv.height - 26);
  if (miss.length) console.warn('пропущены: ' + miss.join(' | '));
}
