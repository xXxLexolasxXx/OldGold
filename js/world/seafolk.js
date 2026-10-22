'use strict';
// Сказочные у воды (МОРЕ.md): русалка у моря и водяной у озёр и рек. Живут в списке морских обитателей (seafauna.js),
// счёт — тот, кто считает игру; клиенты коопа получают их тем же зеркалом и только рисуют.
//  • русалка — редкая гостья ясной ночи: сидит в мелководье у пляжа и поёт; кто подойдёт ближе — спугнёт её
//    (ныряет, иной раз обронив жемчужину); гномёнок, что тихо посидит поодаль, получит подарок — жемчужину;
//  • водяной — по вечерам и ночам выглядывает из озера или реки, курит трубку; рыбаку с удочкой рядом подгоняет
//    рыбу в улов, а того, кто лезет близко, пугает и ныряет. Зимой подо льдом спят оба.

const SF_MERMAID_GAP = 1400;         // русалка не чаще раза в столько секунд (≈2,5 суток; прогон: при 480 с она была раз в сутки — слишком часто)
const SF_VODA_GAP = 900; 

if (typeof SEA_ART !== 'undefined') {
  // русалка: сидит на мелководье 6 кадров (волосы колышутся, хвост плещет), ныряет 6
  SEA_ART.mermaid = { w: 16, h: 20, ax: 8, ay: 17, anims: { sit: 6, dive: 6 }, draw(P, a, f, n) {
    const sway = [0, 1, 1, 0, -1, -1][f % 6], dip = a === 'dive' ? Math.round(f / (n - 1) * 11) : 0;
    const y = 8 + dip;
    P.r(4, y + 4, 7, 5, '#3ea890'); P.r(5, y + 6, 5, 2, '#2a7a6e');                    // хвост в воде
    P.r(9 + (f % 2), y + 8, 4, 2, '#7ad4b8'); P.r(12 + (f % 2), y + 7, 2, 4, '#7ad4b8');   // плавник
    P.r(5, y - 2, 5, 6, '#f0c8a8'); P.r(6, y + 2, 3, 2, '#40c0a8');                    // тело, чешуйчатый пояс
    P.r(5, y - 6, 5, 4, '#f0c8a8'); P.p(8, y - 5, '#14161a');                           // голова, глаз
    P.r(4, y - 7, 7, 2, '#d85a7a'); P.r(3 + sway, y - 5, 2, 8, '#d85a7a'); P.r(10 + sway, y - 5, 2, 7, '#b84060');   // волосы
    if (a === 'sit') { P.l(5, y, 3, y + 2 + (f % 2), '#f0c8a8'); P.p(7, y - 3, '#d03040'); }   // рука у лица, губы
    P.r(2, 17, 12, 1, '#d8eef4'); if (f % 3 === 0) P.p(1, 16, '#ffffff');              // кромка воды
  } };
  // водяной: старик с зелёной бородой и кувшинкой на макушке, по плечи в воде
  SEA_ART.vodyanoy = { w: 16, h: 18, ax: 8, ay: 15, anims: { idle: 6, dive: 6 }, draw(P, a, f, n) {
    const dip = a === 'dive' ? Math.round(f / (n - 1) * 10) : 0, y = 6 + dip, puff = f % 6;
    P.r(3, y + 3, 10, 6, '#3e7a4a'); P.r(4, y + 5, 8, 3, '#2a5a38');                   // плечи, ряска
    P.r(5, y - 3, 6, 6, '#8ab070'); P.r(4, y + 1, 8, 4, '#4a9a52'); P.r(5, y + 4, 6, 2, '#3a7a42');   // голова, борода
    P.p(6, y - 1, '#f0f0a0'); P.p(9, y - 1, '#f0f0a0'); P.r(7, y + 1, 2, 1, '#2a4a2a');  // глаза, нос
    P.r(5, y - 5, 6, 2, '#2e6a3a'); P.r(7, y - 7, 3, 2, '#f4f0c0'); P.p(8, y - 6, '#e0b030');   // кувшинка
    if (a === 'idle') { P.r(10, y + 2, 4, 1, '#7a5230'); if (puff > 1 && puff < 5) P.p(14, y + 1 - (puff - 2), '#d0d8d8'); }   // трубка и дымок
    P.r(2, 15, 12, 1, '#d8eef4'); if (f % 3 === 1) P.p(14, 14, '#ffffff');
  } };
}

const sfFolkHere = k => SL().list.some(o => o.k === k);
function sfNightClear() { return slNight() > 0.55 && !(typeof WX !== 'undefined' && WX.k > 0.3); }

if (typeof SFX_DEF !== 'undefined') {
  Object.assign(SFX_DEF, { mermaidSong: { pri: 1, gain: 0.35, poly: 1, cd: 5, len: 2.4, wet: 0.6 }, vodaHum: { pri: 0, gain: 0.3, poly: 1, cd: 4, len: 1.2 } });
  if (typeof FAUNA_TIER !== 'undefined') Object.assign(FAUNA_TIER, { mermaidSong: 1, vodaHum: 0 });
  // песня: тихие переливы вверх-вниз; водяной: булькающее «кхм»
  Object.assign(SFX, {
    mermaidSong: (d, t, v) => { const b = 520 + v * 60, n = [0, 3, 5, 7, 5, 3, 5, 0]; n.forEach((s, k) => tone(d, 'sine', b * Math.pow(2, s / 12), b * Math.pow(2, s / 12) * 1.01, t + k * 0.28, 0.4, 0.14, 0.08)); },
    vodaHum: (d, t, v) => { tone(d, 'sawtooth', 95 + v * 15, 70, t, 0.5, 0.1, 0.05); for (let k = 0; k < 3; k++) tone(d, 'sine', 300 + k * 90, 520 + k * 110, t + 0.5 + k * 0.1, 0.06, 0.1, 0.005); },
  });
}

// ---------- Появление ----------
{
  const _sp = slSpawnTick;
  slSpawnTick = function () {
    _sp();
    const S = SL();
    if (slIce() > 0.5) return;
    if (sfNightClear() && !sfFolkHere('mermaid') && Game.time - (S.seen.mermaidT ?? -1e9) > SF_MERMAID_GAP && slRand() < 0.2) {
      const p = slPick((x, y) => slSea(x, y) && slDep(x, y) === 1 && (slBeach(x + 1, y) || slBeach(x - 1, y) || slBeach(x, y + 1) || slBeach(x, y - 1) || slBeach(x + 1, y + 1) || slBeach(x - 1, y - 1)), 120);
      if (p) {
        S.seen.mermaidT = Game.time;
        slAdd({ k: 'mermaid', x: p[0], y: p[1], st: 'sit', t: 0, life: 70, face: slRand() < 0.5 ? 1 : -1, sung: 0 });
        logEvent('animal', 'Над лунной водой кто-то поёт — на мелководье сидит русалка', p[0], p[1]);
        if (slOnce('mermToast', 900)) toast('🧜 У берега поёт русалка. Подойдёте близко — уплывёт; а тихий гномёнок может получить подарок.');
        fstat('mermaid');
      }
    }
    if ((slNight() > 0.3 || isEveningNow()) && !sfFolkHere('vodyanoy') && Game.time - (S.seen.vodaT ?? -1e9) > SF_VODA_GAP && slRand() < 0.15) {
      const p = slPick((x, y) => { const k = slKind(x, y); return (k === OC_LAKE || k === OC_RIVER) && slDep(x, y) === 1 && !World.bmap[idx(x, y)]; }, 120);
      if (p) {
        S.seen.vodaT = Game.time;
        slAdd({ k: 'vodyanoy', x: p[0], y: p[1], st: 'idle', t: 0, life: 80, face: slRand() < 0.5 ? 1 : -1, hum: 4 });
        logEvent('animal', 'Из озера выглянул водяной — борода в ряске, трубка дымит', p[0], p[1]);
        fstat('vodyanoy');
      }
    }
  };
}

// ---------- Ход ----------
SL_TICK.mermaid = function (o, dt, hero) {
  if (o.st === 'dive') { if (o.ph > 0.9) return false; return; }
  if (slIce() > 0.5 || slNight() < 0.3) { o.st = 'dive'; o.ph = 0; slSplash(o.x, o.y, 0.5); return; }   // рассвет — ныряет
  const near = slPeopleNear(o.x, o.y, 2.4, u => u.type !== 'kid' || Math.hypot(u.x - o.x, u.y - o.y) < 1.6)[0];
  if (near) {
    o.st = 'dive'; o.ph = 0; slSplash(o.x, o.y, 0.8); floater(o.x, o.y - 1.6, 'Плюх!', '#c8f4e8');
    if (near.type === 'hero' && slRand() < 0.3) { slLootShore(o.x, o.y, 'pearl', 1); floater(o.x, o.y - 2.4, 'Обронила жемчужину!', '#fff0c8'); }
    return;
  }
  o.t += dt;
  if ((o.sung -= dt) <= 0) { o.sung = slR(9, 14); faunaSfx('mermaidSong', o.x, o.y, 0.8); }
  const kid = slPeopleNear(o.x, o.y, 5, u => u.type === 'kid')[0];   // тихий гномёнок поодаль
  if (kid && o.t > 12 && !o.gift) {
    o.gift = true; slLootShore(o.x, o.y, 'pearl', 1);
    floater(kid.x, kid.y - 1.4, 'Подарок русалки!', '#e8f8f0'); fstat('mermaidGift');
    logEvent('gold', 'Русалка оставила жемчужину гномёнку, что слушал песню', o.x, o.y);
  }
};
SL_TICK.vodyanoy = function (o, dt) {
  if (o.st === 'dive') { if (o.ph > 0.9) return false; return; }
  if (slIce() > 0.5 || (slNight() < 0.05 && !isEveningNow())) { o.st = 'dive'; o.ph = 0; slSplash(o.x, o.y, 0.5); return; }
  const near = slPeopleNear(o.x, o.y, 1.8, u => !u.fun)[0];
  if (near) { o.st = 'dive'; o.ph = 0; slSplash(o.x, o.y, 0.8); floater(o.x, o.y - 1.6, 'Кхм! Моё озеро!', '#c8f0b0'); if (!near.injury) scare(near, o); return; }
  if ((o.hum -= dt) <= 0) { o.hum = slR(10, 18); faunaSfx('vodaHum', o.x, o.y, 0.7); }
  // рыбаку с удочкой рядом подгоняет рыбу: поклёвка и лишняя рыбка
  const r = slPeopleNear(o.x, o.y, 6, u => u.fun && u.fun.k === 'rod' && !u.fun.voda)[0];
  if (r) {
    r.fun.voda = true;
    if (!r.fun.bite) r.fun.bite = Game.time + 1.4;
    dropPile(Math.floor(r.x), Math.floor(r.y), 'fish', 1);
    floater(r.x, r.y - 1.4, 'Водяной подогнал рыбку!', '#c8f0b0'); fstat('vodaFish');
  }
};

// ---------- Отрисовка ----------
{
  const _sd = slDraw;
  slDraw = function (c, o) {
    if (o.k !== 'mermaid' && o.k !== 'vodyanoy') return _sd(c, o);
    const a = o.st === 'dive' ? 'dive' : o.k === 'mermaid' ? 'sit' : 'idle';
    const f = a === 'dive' ? Math.min(5, Math.floor(o.ph * 7)) : Math.floor(o.ph * 3);
    seaBlit(c, o.k, a, f, o.x * TILE, o.y * TILE + 4, o.face, o.k === 'mermaid' ? 0.95 : 1);
  };
}
