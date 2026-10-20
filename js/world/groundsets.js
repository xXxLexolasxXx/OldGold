'use strict';
// Виды земли для остальных биомов карты (лес, степь, горы, болото, зима) и сборка наборов по биомам.
// Вид описывается данными: базовая рампа тона, пятна (V.p) и список мелочи (dec) — кисти берутся из groundstyle.js.
// Пятно: ramp — тона, cell/thr — размер и доля, lv — пороги тона внутри пятна, dep — «ямка» с краем,
// grass — на пятне растёт мелочь, ridge — вытянутая полоса (тропа, русло) шириной w вместо пятна.

(function () {
const G = GS_GRASS, ST = GS_STONE, DT = GS_DIRT, DY = GS_DRY;
const SNOW = ['#a6d2e6', '#d6eef6', '#f6f2ea', '#ffffff'];
const ICE = ['#3a74a0', '#5292bc', '#76b2d4', '#a6d2e6', '#d6eef6'];
const T3 = [0.4, 0.6], T4 = [0.38, 0.5, 0.62], T5 = [0.36, 0.46, 0.56, 0.66], T6 = [0.33, 0.42, 0.52, 0.61, 0.70];
const bandOf = (t, th) => { let i = 0; while (i < th.length && t >= th[i]) i++; return i; };

// Собирает вид из описания: поле — пятна по порядку, иначе база
function gsMk(id, set, name, sub, o) {
  const V = { set, name, sub, ramp: o.ramp, p: o.p || [], ticks: o.ticks || 12, depMax: o.depMax, dec: o.dec };
  const base = o.base || { c1: 50, c2: 16, mx: 0.6, thr: o.ramp.length === 4 ? T4 : o.ramp.length === 5 ? T5 : o.ramp.length === 6 ? T6 : T3 };
  V.field = (x, y, s) => {
    for (let i = 0; i < V.p.length; i++) {
      const q = V.p[i], sl = s + 200 + i * 7;
      let n;
      if (q.ridge) { n = gsF(x, y, q.cell, sl) - 0.5 + (gsVN(x, y, 11, sl + 5) - 0.5) * 0.05; if (Math.abs(n) < q.ridge) return [K_P0 + i, bandOf(gsF(x, y, q.tc || 9, sl + 9), q.lv)]; continue; }
      n = gsF(x, y, q.cell, sl) + (gsVN(x, y, q.rc || 6, sl + 3) - 0.5) * (q.rag === undefined ? 0.08 : q.rag);
      if (n > q.thr) return [K_P0 + i, bandOf(gsF(x, y, q.tc || 11, sl + 9), q.lv)];
    }
    const t = gsF(x, y, base.c1, s) * base.mx + gsF(x, y, base.c2, s + 1) * (1 - base.mx);
    return [K_GRASS, bandOf(t, base.thr)];
  };
  V.decor = (S, tx, ty, r) => {
    for (const d of V.dec) {
      if (d.on && d.on.indexOf(S.kc()) < 0) continue;
      S[d.f](r, ...d.a);
    }
  };
  gsRegister(id, V);
  return V;
}
const D = (f, ...a) => ({ f, a });

// ---------- Лес ----------
gsMk('f_litter', 'forest', 'Л1. Хвойная подстилка', 'Тёмная зелень с бурыми пятнами опавшей хвои и мшистыми кочками; папоротник, грибы, прутики.', {
  ramp: [G[1], G[2], G[3], G[4]], ticks: 11,
  p: [{ ramp: [DT[1], DT[2], DT[3]], cell: 60, thr: 0.71, lv: [0.4, 0.75], grass: true }, { ramp: [G[4], G[5], G[6]], cell: 44, thr: 0.68, lv: [0.45, 0.72], grass: true }],
  dec: [D('tufts', 0.5, 2), D('ferns', 0.3), D('mushrooms', 0.12), D('twigs', 0.5), D('litter', 7, ['#6e432a', '#875434', '#3a3a1c']), D('pebbles', 0.02)],
});
gsMk('f_fern', 'forest', 'Л2. Папоротниковая чаща', 'Самая густая и тёмная: сплошной папоротник, пятна солнца среди крон, редкие белые цветы.', {
  ramp: [G[0], G[1], G[2], G[3]], ticks: 10,
  p: [{ ramp: [G[4], G[5], G[6], G[7]], cell: 56, thr: 0.72, lv: [0.4, 0.62, 0.8], grass: true, rag: 0.05 }],
  dec: [D('ferns', 0.85), D('tufts', 0.25, 2), D('mushrooms', 0.05), D('flowerPatch', 0.05, ['#f6f2ea'], 2, 4), D('twigs', 0.15)],
});
gsMk('f_stump', 'forest', 'Л3. Бурелом', 'Валежник, пни, мшистые валуны на влажной тёмной земле; грибы и сухие прутья.', {
  ramp: [G[1], G[2], G[3], G[4]], ticks: 10,
  p: [{ ramp: [DT[0], DT[1], DT[2]], cell: 60, thr: 0.7, lv: [0.4, 0.78], dep: true }],
  dec: [D('twigs', 0.85), D('stump', 0.08), D('boulders', 0.05, true), D('ferns', 0.2), D('mushrooms', 0.1), D('tufts', 0.35, 2), D('roots', 0.5, 8)],
});
gsMk('f_berry', 'forest', 'Л4. Ягодная поляна', 'Светлая поляна среди кустов: земляника, черника, клевер и белые цветы.', {
  ramp: [G[3], G[4], G[5], G[6]], ticks: 12,
  p: [{ ramp: [G[1], G[2], G[3]], cell: 80, thr: 0.62, lv: [0.45, 0.7], grass: true }],
  dec: [D('berries', 0.3, ['#c8583a', '#a85a6a', '#38245c']), D('flowerPatch', 0.2, ['#f6f2ea', '#f6d458'], 3, 5), D('clover', 0.4), D('tufts', 0.5, 2), D('daisies', 0.2), D('mushrooms', 0.04)],
});
gsMk('f_roots', 'forest', 'Л5. Корни и мох', 'Тёмная сырая земля с корнями, ковры мха, валуны в моху, папоротник.', {
  ramp: [G[0], G[1], G[2], G[3]], ticks: 10,
  p: [{ ramp: [DT[0], DT[1], DT[2]], cell: 54, thr: 0.74, lv: [0.4, 0.75], dep: true }, { ramp: [G[4], G[5], G[6]], cell: 42, thr: 0.66, lv: [0.45, 0.7], grass: true }],
  dec: [D('roots', 0.75, 8), D('ferns', 0.3), D('mushrooms', 0.12), D('boulders', 0.05, true), D('tufts', 0.4, 2), D('pebbles', 0.03)],
});

// ---------- Степь ----------
gsMk('s_feather', 'steppe', 'С2. Ковыль', 'Серебристый ковыль: море светлых метёлок над золотистой травой, редкие камешки.', {
  ramp: [DY[2], DY[3], DY[4], DY[5]], ticks: 12,
  p: [{ ramp: [G[3], G[4], G[5]], cell: 90, thr: 0.68, lv: [0.45, 0.7], grass: true, rag: 0.1 }],
  dec: [D('stalks', 0.95, ['#cec6ba', '#f6f2ea', '#e4ddd2']), D('stalks', 0.4, ['#c0ae5c', '#ddd08a', '#c89226']), D('tufts', 0.35, 2, true), D('pebbles', 0.03)],
});
gsMk('s_stubble', 'steppe', 'С3. Золотое жнивьё', 'Сжатое поле: золотая стерня, колосья, охристые пятна земли и сорная трава.', {
  ramp: [DY[2], DY[3], DY[4]], ticks: 15,
  p: [{ ramp: [DT[4], DT[5], DT[6]], cell: 64, thr: 0.68, lv: [0.4, 0.75], dep: true }],
  dec: [D('stalks', 0.8, ['#c89226', '#e4b434', '#f6d458']), D('tufts', 0.5, 2, true), D('thistles', 0.04), D('pebbles', 0.05), D('litter', 8, ['#a4701c', '#7e5214'])],
});
gsMk('s_clay', 'steppe', 'С4. Выжженная глина', 'Растрескавшаяся глина, выгоревшие пятна, редкая сухая травка и чертополох.', {
  ramp: [DT[4], DT[5], DT[6], DT[7]], ticks: 10,
  p: [{ ramp: [DT[2], DT[3], DT[4]], cell: 50, thr: 0.7, lv: [0.4, 0.75], dep: true }, { ramp: [DY[1], DY[2], DY[3]], cell: 70, thr: 0.72, lv: [0.45, 0.72], grass: true }],
  dec: [D('cracks', 8, '#341f14', '#a06840'), D('cracks', 8, '#583522', '#b8804e'), D('pebbles', 0.1), D('gravel', 5), D('thistles', 0.07), D('stalks', 0.15, ['#c0ae5c', '#ddd08a', '#c89226']), D('boulders', 0.04, false)],
});
gsMk('s_sage', 'steppe', 'С5. Полынь', 'Серо-оливковая степь: кусты полыни, щебень, пыльные пятна.', {
  ramp: [DY[1], DY[2], DY[3], DY[4]], ticks: 11,
  p: [{ ramp: [ST[3], ST[4], ST[5]], cell: 60, thr: 0.72, lv: [0.4, 0.75] }],
  dec: [D('sage', 0.45), D('gravel', 6), D('pebbles', 0.12), D('tufts', 0.3, 2, true), D('stalks', 0.2, ['#9c8e48', '#c0ae5c', '#ddd08a']), D('thistles', 0.05)],
});
gsMk('s_tulip', 'steppe', 'С6. Тюльпановая степь', 'Весенняя степь: зелёная трава с золотом, красные и жёлтые тюльпаны, маки.', {
  ramp: [G[3], G[4], G[5], DY[3], DY[4]], ticks: 13,
  p: [],
  dec: [D('flowerPatch', 0.45, ['#e86a4a', '#f6d458', '#d47cc8', '#c8583a'], 5, 9), D('tufts', 0.5, 2), D('stalks', 0.3, ['#c0ae5c', '#ddd08a', '#c89226']), D('daisies', 0.15), D('pebbles', 0.03)],
});

// ---------- Горы ----------
gsMk('m_alpine', 'mountain', 'Г1. Альпийский луг', 'Короткая сочная трава среди камней: колокольчики, горечавки, ромашки.', {
  ramp: [G[2], G[3], G[4], G[5], G[6]], ticks: 13,
  p: [{ ramp: [ST[3], ST[4], ST[5]], cell: 70, thr: 0.72, lv: [0.4, 0.75] }],
  dec: [D('bells', 0.35, '#7e58cc'), D('bells', 0.2, '#5292bc'), D('daisies', 0.25), D('flowerPatch', 0.15, ['#f6d458', '#f6f2ea'], 3, 5), D('tufts', 0.5, 2), D('boulders', 0.04, true), D('pebbles', 0.05)],
});
gsMk('m_scree', 'mountain', 'Г2. Осыпь', 'Серый щебень и плиты, кое-где пробивается трава; валуны и мелкие камни.', {
  ramp: [ST[2], ST[3], ST[4], ST[5]], ticks: 9,
  p: [{ ramp: [G[2], G[3], G[4]], cell: 52, thr: 0.62, lv: [0.45, 0.72], grass: true }],
  dec: [D('gravel', 7), D('boulders', 0.1, false), D('pebbles', 0.12), D('tufts', 0.3, 2)],
});
gsMk('m_trail', 'mountain', 'Г3. Горная тропа', 'Зелёные склоны и каменистая тропа с плитами и галькой.', {
  ramp: [G[2], G[3], G[4], G[5]], ticks: 12,
  p: [{ ramp: [ST[4], ST[5], ST[6]], ridge: 0.025, cell: 140, lv: [0.4, 0.75], dep: true }],
  dec: [D('tufts', 0.5, 2), D('pebbles', 0.1), D('boulders', 0.05, false), D('gravel', 4), D('bells', 0.1, '#7e58cc'), D('daisies', 0.1)],
});
gsMk('m_heather', 'mountain', 'Г4. Вереск', 'Тёмные пустоши в лиловом вереске, колючки и серые камни.', {
  ramp: [G[1], G[2], G[3], DY[1]], ticks: 11,
  p: [{ ramp: ['#281a40', '#38245c', '#4c3080', '#6440a8'], cell: 40, thr: 0.62, lv: [0.35, 0.6, 0.8], grass: true }],
  dec: [D('heather', 0.65), D('tufts', 0.4, 2), D('boulders', 0.06, false), D('pebbles', 0.06), D('thistles', 0.04), D('stalks', 0.15, ['#7a7038', '#9c8e48', '#c0ae5c'])],
});
gsMk('m_lichen', 'mountain', 'Г5. Лишайник', 'Скальная плита в жёлто-зелёных лишайниках и моху; трещины и валуны.', {
  ramp: [ST[2], ST[3], ST[4], ST[5]], ticks: 9,
  p: [{ ramp: [DY[1], DY[2], DY[3]], cell: 30, thr: 0.6, lv: [0.4, 0.75], grass: true }, { ramp: [G[3], G[4], G[5]], cell: 38, thr: 0.64, lv: [0.45, 0.72], grass: true }],
  dec: [D('boulders', 0.12, true), D('gravel', 7), D('pebbles', 0.1), D('tufts', 0.2, 2)],
});

// ---------- Болото ----------
const SW = ['#141c12', '#1c2818', '#243520', '#2f4a26', '#3a5a2a'];
gsMk('w_bog', 'swamp', 'Б1. Трясина', 'Тёмная топь с чёрными окнами воды, камыш и рогоз, кочки.', {
  ramp: [SW[1], SW[2], SW[3], SW[4]], ticks: 9,
  p: [{ ramp: ['#0c1624', '#12263c', '#1a3654'], cell: 50, thr: 0.68, lv: [0.4, 0.75], dep: true }],
  dec: [D('reeds', 0.55), D('puddle', 0.2), D('tufts', 0.4, 2), D('mushrooms', 0.04), D('twigs', 0.15), D('cotton', 0.15)],
});
gsMk('w_hummock', 'swamp', 'Б2. Кочкарник', 'Светлые моховые кочки островками на чёрной жиже.', {
  ramp: [DT[0], DT[1], DT[2]], ticks: 8,
  p: [{ ramp: [G[2], G[3], G[4], G[5]], cell: 26, thr: 0.54, lv: [0.4, 0.62, 0.8], grass: true }],
  dec: [D('tufts', 0.5, 3), D('cotton', 0.45), D('reeds', 0.2), D('puddle', 0.1), D('mushrooms', 0.05)],
});
gsMk('w_algae', 'swamp', 'Б3. Тина', 'Зелёная ряска и тина по всей поверхности, прогалины воды и камыш.', {
  ramp: [G[1], G[2], G[3]], ticks: 9,
  p: [{ ramp: [G[5], G[6], G[7]], cell: 34, thr: 0.54, lv: [0.4, 0.7], grass: false }, { ramp: ['#12263c', '#1a3654', '#22486c'], cell: 60, thr: 0.7, lv: [0.4, 0.75], dep: true }],
  dec: [D('reeds', 0.35), D('puddle', 0.25), D('tufts', 0.2, 2)],
});
gsMk('w_alder', 'swamp', 'Б4. Олешник', 'Сырая бурая земля, валежник и грибы под ольхой, редкий папоротник.', {
  ramp: [SW[2], SW[3], '#3a3a1c', '#57532a'], ticks: 9,
  p: [{ ramp: [DT[0], DT[1], DT[2]], cell: 48, thr: 0.62, lv: [0.4, 0.78], dep: true }],
  dec: [D('mushrooms', 0.25), D('twigs', 0.7), D('ferns', 0.2), D('roots', 0.5, 8), D('tufts', 0.35, 2), D('stump', 0.04)],
});
gsMk('w_cranberry', 'swamp', 'Б5. Клюквенник', 'Бурый мох с красной клюквой, пушица и зелёные проплешины.', {
  ramp: [DT[1], DT[2], DT[3], DT[4]], ticks: 10,
  p: [{ ramp: [G[2], G[3], G[4]], cell: 50, thr: 0.6, lv: [0.45, 0.72], grass: true }],
  dec: [D('berries', 0.3, ['#c8583a', '#ac3e2a']), D('cotton', 0.4), D('tufts', 0.35, 2, true), D('puddle', 0.05), D('reeds', 0.1)],
});

// ---------- Зима ----------
gsMk('i_fresh', 'winter', 'З1. Свежий снег', 'Ровный чистый снег с голубыми тенями, искры и цепочки следов, торчащие сухие травинки.', {
  ramp: SNOW, ticks: 6, depMax: 1,
  p: [],
  dec: [D('sparkle', 5), D('tracks', 0.12), D('stalks', 0.1, ['#9c8e48', '#c0ae5c', '#ddd08a']), D('pebbles', 0.02)],
  base: { c1: 70, c2: 22, mx: 0.6, thr: [0.22, 0.4, 0.62] },
});
gsMk('i_drifts', 'winter', 'З2. Сугробы', 'Волны сугробов с синими тенями с подветренной стороны, наст, искры.', {
  ramp: SNOW, ticks: 5, depMax: 1,
  p: [{ ramp: ['#76b2d4', '#a6d2e6', '#d6eef6'], cell: 46, thr: 0.58, lv: [0.4, 0.72], dep: true, grass: true, rag: 0.05 }],
  dec: [D('sparkle', 6), D('stalks', 0.08, ['#7a7038', '#9c8e48', '#c0ae5c']), D('tracks', 0.07)],
  base: { c1: 64, c2: 20, mx: 0.6, thr: [0.26, 0.45, 0.66] },
});
gsMk('i_thaw', 'winter', 'З3. Проталины', 'Снег с проталинами: бурая земля, сухая трава, камешки и лужицы талой воды.', {
  ramp: SNOW, ticks: 6, depMax: 1,
  p: [{ ramp: [DT[1], DT[2], DT[3]], cell: 52, thr: 0.64, lv: [0.4, 0.75], dep: true, grass: true }, { ramp: [DY[1], DY[2], DY[3]], cell: 40, thr: 0.62, lv: [0.4, 0.72], grass: true }],
  dec: [D('stalks', 0.5, ['#7a7038', '#9c8e48', '#c0ae5c']), D('tufts', 0.4, 2, true), D('pebbles', 0.1), D('sparkle', 3), D('puddle', 0.04)],
  base: { c1: 64, c2: 20, mx: 0.6, thr: [0.22, 0.4, 0.62] },
});
gsMk('i_needles', 'winter', 'З4. Хвоя на снегу', 'Снег, засыпанный хвоей и шишками, ветки, следы зверей.', {
  ramp: SNOW, ticks: 6, depMax: 1,
  p: [{ ramp: ['#243520', '#2f4a26', '#3a5a2a'], cell: 70, thr: 0.7, lv: [0.4, 0.75], grass: true }],
  dec: [D('litter', 5, ['#2f4a26', '#3a5a2a', '#583522']), D('twigs', 0.4), D('tracks', 0.18), D('sparkle', 4), D('stump', 0.03)],
  base: { c1: 66, c2: 21, mx: 0.6, thr: [0.22, 0.4, 0.62] },
});
gsMk('i_ice', 'winter', 'З5. Иней и лёд', 'Ледяная корка с трещинами, иней, снежные наносы.', {
  ramp: ICE, ticks: 5, depMax: 1,
  p: [{ ramp: [SNOW[1], SNOW[2], SNOW[3]], cell: 54, thr: 0.6, lv: [0.4, 0.7], grass: true }, { ramp: ['#3a74a0', '#5292bc', '#76b2d4'], cell: 40, thr: 0.68, lv: [0.4, 0.75], dep: true }],
  dec: [D('cracks', 9, '#3a74a0', '#d6eef6'), D('cracks', 9, '#22486c', '#a6d2e6'), D('sparkle', 7), D('stalks', 0.04, ['#7a7038', '#9c8e48', '#c0ae5c'])],
  base: { c1: 56, c2: 18, mx: 0.6, thr: [0.2, 0.36, 0.52, 0.68] },
});

// ---------- Наборы по биомам карты (доли площади) ----------
gsMakeSet('meadow', [['meadow', 30], ['glades', 13], ['trails', 12], ['spring', 8], ['mossy', 27]], { id: 'steppe', thr: 0.71 });
gsMakeSet('forest', [['f_litter', 28], ['f_fern', 22], ['f_stump', 18], ['f_berry', 12], ['f_roots', 20]]);
gsMakeSet('steppe', [['steppe', 25], ['s_feather', 24], ['s_stubble', 14], ['s_clay', 14], ['s_sage', 13], ['s_tulip', 10]]);
gsMakeSet('mountain', [['m_alpine', 24], ['m_scree', 24], ['m_trail', 15], ['m_heather', 15], ['m_lichen', 22]]);
gsMakeSet('swamp', [['w_bog', 30], ['w_hummock', 22], ['w_algae', 14], ['w_alder', 18], ['w_cranberry', 16]]);
gsMakeSet('winter', [['i_fresh', 35], ['i_drifts', 22], ['i_thaw', 15], ['i_needles', 15], ['i_ice', 13]]);
// у уже существующих видов лугов и степи — свой набор
for (const id of ['meadow', 'glades', 'trails', 'spring', 'mossy']) GROUND_VARIANTS[id].set = 'meadow';
GROUND_VARIANTS.steppe.set = 'steppe'; GROUND_VARIANTS.steppe.name = 'С1. Сухая степь';
})();
