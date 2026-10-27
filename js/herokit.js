'use strict';
// Снаряжение и способности классов героя, бой героя.
// · Каждому классу — простое оружие первого уровня в рюкзак (ржавое, треснутое, увядшее): небольшой бонус
//   к характеристикам; своё оружие герой надевает с первого раза.
// · По две классовые способности по мотивам D&D (вторая — с 4 уровня): перезарядка, значок, описание; клавиши Z и X.
// · Бой героя: выхватывает оружие из ножен, замах → удар → довод, парирует и морщится от ударов, победная стойка
//   (кадры — в people.js, здесь — когда какой показывать); на ходу в бою оружие в руке, потом снова в ножнах.
// · Нечисть ночи в бою с героем и рекрутами держит больше ударов и бьёт в ответ сильнее с каждой ночью (nightDiff).
// Подключается после neutrals.js. Рюкзак и способности — в одиночной игре (как herolife.js); облик оружия,
// кадры боя и крепость нечисти работают и в общей деревне: сервер грузит этот же файл.

// ---------- Оружие первого уровня ----------
// w — облик в people.js (WPN_STYLE), bonus — к характеристикам, atk — к удару, def — к защите
const KIT_ITEMS = {
  rustySword:   { slot: 'weapon', name: 'Ржавый меч', w: 'rsword', bonus: { str: 2 }, atk: 0.06 },
  woodShield:   { slot: 'off', name: 'Деревянный щит', w: 'wshield', bonus: { end: 2 }, def: 0.1 },
  rustyAxe2:    { slot: 'weapon', name: 'Ржавая двуручная секира', w: 'axe2', bonus: { str: 3, end: 1 }, atk: 0.08 },
  sparkStaff:   { slot: 'weapon', name: 'Искрящий посох', w: 'sstaff', bonus: { int: 3 }, atk: 0.06 },
  witherStaff:  { slot: 'weapon', name: 'Увядший посох', w: 'wstaff', bonus: { int: 2, end: 1 }, atk: 0.05 },
  rustyDagger:  { slot: 'weapon', name: 'Ржавый кинжал', w: 'rdagger', bonus: { agi: 2 }, atk: 0.05 },
  brokenDagger: { slot: 'off', name: 'Сломанный кинжал', w: 'bdagger', bonus: { agi: 1 }, atk: 0.02 },
  crookedBow:   { slot: 'weapon', name: 'Кривой лук', w: 'cbow', bonus: { agi: 2 }, atk: 0.06 },
  oldWraps:     { slot: 'weapon', name: 'Потёртые обмотки', w: 'fists', bonus: { agi: 1, end: 1 }, atk: 0.04 },
  crackedMace:  { slot: 'weapon', name: 'Треснувшая булава', w: 'cmace', bonus: { str: 1, int: 1 }, atk: 0.05 },
  bentRapier:   { slot: 'weapon', name: 'Гнутая шпага', w: 'rsword', bonus: { agi: 1, int: 1 }, atk: 0.05 },
};
const KIT_OF = {
  warrior: ['rustySword', 'woodShield'], barbarian: ['rustyAxe2'], mage: ['sparkStaff'], druid: ['witherStaff'],
  rogue: ['rustyDagger', 'brokenDagger'], archer: ['crookedBow'], monk: ['oldWraps'], priest: ['crackedMace'],
  bard: ['bentRapier'], paladin: ['crackedMace', 'woodShield'],
};
// облик оружия из оружейной
const WPN_LOOK = { sword: 'sword', dagger: 'dagger', staff: 'staff', bow: 'bow' };
const STAT_RU = { str: 'сила', agi: 'ловкость', int: 'смекалка', end: 'стойкость' };

if (typeof HL_GEAR !== 'undefined') for (const k in KIT_ITEMS) HL_GEAR[k] = { slot: KIT_ITEMS[k].slot, name: KIT_ITEMS[k].name };
if (typeof GEAR_BONUS !== 'undefined') for (const k in KIT_ITEMS) GEAR_BONUS[k] = Object.assign({}, KIT_ITEMS[k].bonus, { atk: KIT_ITEMS[k].atk || 0, def: KIT_ITEMS[k].def || 0 });

const kitBonusText = k => Object.entries(KIT_ITEMS[k].bonus).map(([s, v]) => `${STAT_RU[s]} ${v > 0 ? '+' : ''}${v}`).join(', ');
// для окна гильдии: что выдадут в рюкзак
function heroKitText(cls) {
  const ks = KIT_OF[cls];
  return ks ? 'в рюкзак: ' + ks.map(k => KIT_ITEMS[k].name.toLowerCase()).join(' и ') : '';
}
const kitMine = (H, k) => !!(KIT_ITEMS[k] && H && KIT_OF[H.clsKey] && KIT_OF[H.clsKey].includes(k));

function heroWpnFrame(u) {
  const w = u._wanim;
  return w ? wpnAnimFrame(w.k, Game.time - w.t0) : null;
}

// Любая нечисть (призраки, скелеты, летучие мыши) в 8 клетках — оружие выхвачено само
const UNDEAD_R = 8;
function heroSeesUndead(u) {
  const r2 = UNDEAD_R * UNDEAD_R, near = e => e && !e.dead && (e.x - u.x) ** 2 + (e.y - u.y) ** 2 <= r2;
  for (const g of Game.ghosts || []) if (g.alpha > 0.05 && near(g)) return true;
  for (const s of Game.skels || []) if (near(s)) return true;
  for (const b of Game.bats || []) if (near(b)) return true;
  return false;
}

// оружие рекрутов и глав гильдий — по классу (то, что им выдаёт гильдия)
const REC_WPN = { warrior: 'sword', archer: 'bow', rogue: 'dagger', mage: 'staff', barbarian: 'axe2', druid: 'staff' };

// Строка оружия для спрайта (people.js): 'основное|левая рука|1 — выхвачено'
function heroWpnOf(u) {
  const H = u.hero;
  let m = '', o = '';
  if (H) {
    const eq = H.equip || {};
    const look = k => (k && KIT_ITEMS[k] ? KIT_ITEMS[k].w : WPN_LOOK[k] || '');
    m = look(eq.weapon); o = look(eq.off);
    // в общей деревне рюкзаки чужих героев не видны: облик — по оружию класса
    if (!m && !o && H.owner && KIT_OF[H.clsKey]) { const ks = KIT_OF[H.clsKey]; m = look(ks[0]); o = look(ks[1]); }
  } else {
    const Rc = u.rec || u.gx, cls = Rc ? Rc.cls : u.gm && typeof u.type === 'string' && u.type.startsWith('gm_') ? u.type.slice(3) : null;
    m = REC_WPN[cls] || '';
  }
  if (!m && !o) return '';
  const now = Game.time;
  const want = !!(heroSeesUndead(u) || u.combatUntil > now || (u.anim && FIGHT_ANIM_SET.has(u.anim)) || (u.hfx && u.hfx.t > now));
  // смена состояния запускает 4-кадровое выхватывание или убирание (кадры берёт heroWpnFrame в render.js)
  if (u._wo === undefined) u._wo = want;
  if (want !== u._wo) { u._wo = want; u._wanim = { k: want ? 'd' : 's', t0: now }; }
  const out = u._wo || (u._wanim && u._wanim.k === 's' && now - u._wanim.t0 < WPN_DRAW_T);
  return `${m}|${o}|${out ? 1 : 0}`;
}

// ---------- Способности классов ----------
// У каждого класса свои 4–5 способностей (общих нет: зелье лечения и огненный шар для всех убраны в 0.10.69),
// открываются по уровням до 15. Одна ячейка — одна способность: панель быстрых способностей (heroabil.js) и клавиши 1–5.
// cost — цена в ресурсе класса (мана / ярость / энергия / вера), cd — перезарядка, lvl — с какого уровня.
// heal — лечит долю здоровья (+1% за уровень), team — и команду рядом; buf на dur секунд:
// atk — точность, dmg — урон, red — меньше урона по герою (минус — больше), dodge — уклонение, spd — удары чаще,
// regen — здоровья в секунду; shots — снаряды без промаха по врагам рядом; next — следующий удар без промаха ×mul;
// fx — особое действие из ABIL_FX (heroabil.js): оглушение, ловушка, призыв зверя, освящение…;
// passive — пассивная (не нажимается): { red, atk, dodge, hpr — здоровья в секунду, res — ресурс быстрее ×, heal — лечение сильнее ×, cd — перезарядка × }
const HERO_ABIL = {
  warrior: [
    { k: 'bash', name: 'Удар щитом', cost: 20, cd: 10, fx: 'bash', desc: 'Бьёт ближайшего врага щитом: удар и оглушение на 3 с' },
    { k: 'cry', name: 'Боевой клич', lvl: 3, cost: 15, cd: 45, dur: 10, buf: { atk: 0.15 }, fx: 'cry', desc: 'Гномы и отряд в 9 клетках бодрее 20 с, сам 10 с точнее на 15%' },
    { k: 'stand', name: 'Непоколебимость', lvl: 6, passive: { red: 0.15 }, desc: 'Пассивно: урон по воину меньше на 15%' },
    { k: 'surge', name: 'Всплеск действий', lvl: 9, cost: 30, cd: 60, dur: 8, buf: { spd: 0.5, atk: 0.25 }, desc: '8 с: бьёт вдвое чаще и на четверть точнее' },
    { k: 'wall', name: 'Стена щитов', lvl: 12, cost: 40, cd: 90, dur: 8, buf: { red: 0.6 }, fx: 'wall', desc: '8 с: урон по нему −60%, враги в 3 клетках сбиты с ног' },
    { k: 'ult_warrior', name: 'Несокрушимый строй', lvl: 13, ult: true, cost: 80, cd: 240, dur: 12, buf: { red: 0.8, atk: 0.2 }, fx: 'ult_warrior', desc: 'Ульта. 12 с: урон по воину −80%, враги в 5 клетках сбиты с ног, гномы и отряд в 9 клетках под щитом' },
  ],
  barbarian: [
    { k: 'rage', name: 'Ярость', cost: 30, cd: 60, dur: 15, buf: { dmg: 0.5, red: 0.4 }, desc: '15 с: урон +50%, а по нему — на 40% слабее' },
    { k: 'reckless', name: 'Безрассудная атака', lvl: 3, cost: 15, cd: 30, dur: 8, buf: { atk: 0.35, red: -0.25 }, desc: '8 с: попадает на 35% чаще, но и сам открыт: урон по нему +25%' },
    { k: 'stomp', name: 'Топот', lvl: 6, cost: 25, cd: 25, fx: 'stomp', desc: 'Топает так, что враги в 3 клетках падают на 2,5 с и получают удар' },
    { k: 'hide', name: 'Толстая шкура', lvl: 9, passive: { red: 0.12, hpr: 0.3 }, desc: 'Пассивно: урон по нему −12%, ссадины затягиваются сами' },
    { k: 'roar', name: 'Рык', lvl: 11, cost: 20, cd: 30, fx: 'roar', desc: 'Рычит так, что лесные враги в 4 клетках 6 с еле волочат ноги, а нечисть пятится' },
    { k: 'ult_barbarian', name: 'Гнев предков', lvl: 13, ult: true, cost: 80, cd: 240, dur: 15, buf: { dmg: 1, red: 0.5, spd: 0.5 }, fx: 'ult_barbarian', desc: 'Ульта. 15 с: урон вдвое выше, по нему −50%, бьёт чаще; враги в 4 клетках падают и получают удар' },
  ],
  archer: [
    { k: 'aimed', name: 'Меткий выстрел', cost: 25, cd: 12, next: 2.5, desc: 'Следующий выстрел — без промаха и в 2,5 раза сильнее' },
    { k: 'volley', name: 'Залп', lvl: 3, cost: 40, cd: 40, shots: { n: 5, kind: 'arrow', r: 8, mul: 0.8 }, desc: 'Пять стрел без промаха по всем врагам в 8 клетках' },
    { k: 'trap', name: 'Ловушка', lvl: 6, cost: 30, cd: 30, fx: 'trap', desc: 'Ставит капкан под ноги (до двух): враг, наступивший на него, застревает на 5 с' },
    { k: 'eagle', name: 'Орлиный глаз', lvl: 9, passive: { atk: 0.1 }, desc: 'Пассивно: стреляет на 10% точнее' },
    { k: 'leap', name: 'Отскок', lvl: 11, cost: 20, cd: 18, dur: 1, buf: { dodge: 0.9 }, fx: 'leap', desc: 'Прыжок на 3 клетки от ближайшего врага; на миг почти неуязвим — тяжёлый удар уходит мимо' },
    { k: 'ult_archer', name: 'Дождь стрел', lvl: 13, ult: true, cost: 80, cd: 200, shots: { n: 14, kind: 'arrow', r: 10, mul: 1.2 }, fx: 'ult_archer', desc: 'Ульта. С неба падают четырнадцать стрел без промаха по врагам в 10 клетках' },
  ],
  rogue: [
    { k: 'sneak', name: 'Скрытая атака', cost: 25, cd: 15, next: 3, desc: 'Следующий удар — без промаха и втрое сильнее; скелета или дерево — с одного удара' },
    { k: 'trip', name: 'Подножка', lvl: 3, cost: 20, cd: 14, fx: 'trip', desc: 'Ближайший враг падает на 3,5 с — по лежачему не промахнёшься' },
    { k: 'steal', name: 'Воровство', lvl: 6, cost: 30, cd: 90, fx: 'steal', desc: 'Обчищает ближайшего врага в 3 клетках: золото на склад или еда в рюкзак' },
    { k: 'vanish', name: 'Исчезновение', lvl: 9, cost: 40, cd: 60, dur: 6, buf: { dodge: 0.9 }, next: 3, fx: 'vanish', desc: '6 с: враги теряют плута из виду, следующий удар — втрое сильнее' },
    { k: 'nimble', name: 'Увёртливость', lvl: 12, passive: { dodge: 0.15 }, desc: 'Пассивно: уходит от 15% ударов' },
    { k: 'ult_rogue', name: 'Танец теней', lvl: 13, ult: true, cost: 80, cd: 200, dur: 6, buf: { dodge: 0.9 }, next: 3, fx: 'ult_rogue', desc: 'Ульта. Мелькает между шестью врагами в 8 клетках и бьёт каждого втрое сильнее; 6 с почти неуязвим' },
  ],
  mage: [
    { k: 'fire', name: 'Огненный шар', cost: 10, cd: 6, fx: 'fire', desc: 'Летит в ближайшего врага в 9 клетках: скелет рассыпается, дерево загорается' },
    { k: 'ward', name: 'Оберег', lvl: 3, cost: 12, cd: 25, fx: 'ward', desc: 'Гонит призраков, пугает скелетов и нечисть; 20 с призраки не студят ману' },
    { k: 'frost', name: 'Ледяная стрела', lvl: 5, cost: 14, cd: 12, fx: 'frost', desc: 'Удар льдом по ближайшему врагу: он замерзает на 4 с' },
    { k: 'shield', name: 'Щит', lvl: 8, cost: 16, cd: 40, dur: 6, buf: { red: 0.7 }, desc: '6 с: невидимая преграда — урон по магу меньше на 70%' },
    { k: 'spring', name: 'Источник', lvl: 11, passive: { res: 1.6 }, desc: 'Пассивно: мана копится в 1,6 раза быстрее' },
    { k: 'ult_mage', name: 'Метеоритный дождь', lvl: 13, ult: true, cost: 60, cd: 240, fx: 'ult_mage', desc: 'Ульта. 6 с с неба падают метеориты на 4 клетки вокруг врагов: скелеты рассыпаются, нечисть горит' },
  ],
  druid: [
    { k: 'thorns', name: 'Шипы', cost: 10, cd: 14, fx: 'thorns', desc: 'Из земли под тремя ближайшими врагами (до 5 клеток) лезут шипы: удар и 2 с в путах' },
    { k: 'grow', name: 'Рост', lvl: 3, cost: 15, cd: 60, fx: 'grow', desc: 'Поля в 6 клетках разом подрастают на четверть' },
    { k: 'mend', name: 'Целебное слово', lvl: 5, cost: 20, cd: 35, heal: 0.2, team: true, desc: 'Слово леса: +20% здоровья себе и команде рядом, снимает раны' },
    { k: 'beast', name: 'Призыв зверя', lvl: 8, cost: 25, cd: 90, dur: 25, fx: 'beast', desc: '25 с рядом бегает дух-волк и кусает ближайших врагов' },
    { k: 'wild', name: 'Дикий облик', lvl: 12, cost: 30, cd: 90, dur: 20, buf: { dmg: 0.4, red: 0.3, regen: 1.5 }, desc: '20 с: медвежья сила — урон +40%, урон по нему −30%, раны затягиваются' },
    { k: 'ult_druid', name: 'Гнев природы', lvl: 13, ult: true, cost: 55, cd: 240, fx: 'ult_druid', desc: 'Ульта. 12 с лес встаёт стеной в 5 клетках: враги в путах, команда и гномы выздоравливают, поля подрастают' },
  ],
  priest: [
    { k: 'heal', name: 'Исцеление', cost: 18, cd: 30, heal: 0.22, team: true, desc: '+22% здоровья себе и команде в 8 клетках, снимает раны' },
    { k: 'cure', name: 'Снятие болезней', lvl: 3, cost: 15, cd: 45, fx: 'cure', desc: 'Гномы в 8 клетках выздоравливают от хвори и ран' },
    { k: 'bless', name: 'Благословение', lvl: 5, cost: 20, cd: 40, dur: 12, buf: { atk: 0.2, red: 0.1 }, fx: 'bless', desc: '12 с: жрец и команда рядом точнее на 20% и крепче' },
    { k: 'turn', name: 'Изгнание нежити', lvl: 8, cost: 25, cd: 50, turn: true, desc: 'Скелеты в 6 клетках рассыпаются (шанс растёт с уровнем), нечисть пятится' },
    { k: 'mercy', name: 'Милосердие', lvl: 11, passive: { heal: 1.25, hpr: 0.3 }, desc: 'Пассивно: лечит на четверть сильнее, сам понемногу выздоравливает' },
    { k: 'ult_priest', name: 'Чудо', lvl: 13, ult: true, cost: 60, cd: 300, fx: 'ult_priest', desc: 'Ульта. Столб света: все рядом (10 клеток) исцелены полностью, хворь и раны сняты, нежить рассыпается' },
  ],
  paladin: [
    { k: 'hands', name: 'Наложение рук', cost: 25, cd: 45, heal: 0.25, team: true, desc: '+25% здоровья себе и команде рядом, снимает раны' },
    { k: 'smite', name: 'Святой удар', lvl: 3, cost: 20, cd: 15, next: 2.5, desc: 'Следующий удар — без промаха и в 2,5 раза сильнее; по нечисти бьёт святым светом' },
    { k: 'consecrate', name: 'Освящение', lvl: 6, cost: 30, cd: 40, fx: 'consecrate', desc: '10 с земля в 3 клетках светится: нечисть горит, команда в круге выздоравливает' },
    { k: 'faith', name: 'Щит веры', lvl: 9, cost: 25, cd: 50, dur: 8, buf: { red: 0.4 }, fx: 'faith', desc: '8 с: урон по паладину и команде рядом −40%' },
    { k: 'aura', name: 'Аура мужества', lvl: 12, passive: { atk: 0.08, red: 0.08 }, desc: 'Пассивно: точнее на 8%, урон по нему −8%' },
    { k: 'ult_paladin', name: 'Кара Костра', lvl: 13, ult: true, cost: 60, cd: 300, dur: 12, buf: { red: 0.5 }, fx: 'ult_paladin', desc: 'Ульта. 12 с над героем встаёт солнце: нечисть в 5 клетках горит, команда в круге выздоравливает, по паладину −50%' },
  ],
  // бард и паладин — Клятвы Песни и Костра (oaths.js добавляет им действие на гномов: oath)
  bard: [
    { k: 'inspire', name: 'Песня бодрости', cost: 12, cd: 40, dur: 12, buf: { atk: 0.2 }, oath: 'song', desc: '12 с: попадает на 20% точнее, гномы в 6 клетках веселеют — «Бард играет»' },
    { k: 'chord', name: 'Оглушающий аккорд', lvl: 3, cost: 18, cd: 30, fx: 'chord', desc: 'Враги в 4 клетках оглушены на 2,5 с' },
    { k: 'five', name: 'Дай пять!', lvl: 5, cost: 10, cd: 60, oath: 'five', desc: 'До шести гномов рядом получают «Дали пять»: настроение вверх на полторы минуты' },
    { k: 'voice', name: 'Звонкий голос', lvl: 9, passive: { cd: 0.85, res: 1.3 }, desc: 'Пассивно: перезарядка короче на 15%, мана копится быстрее' },
    { k: 'sour', name: 'Фальшивая нота', lvl: 11, cost: 20, cd: 35, fx: 'sour', desc: 'Нота мимо всех ладов: враги в 5 клетках 2 с стоят как вкопанные, потом ещё 3 с плетутся' },
    { k: 'ult_bard', name: 'Эпическая баллада', lvl: 13, ult: true, cost: 55, cd: 240, dur: 15, buf: { atk: 0.3, spd: 0.25 }, fx: 'ult_bard', desc: 'Ульта. 15 с поёт так, что враги в 6 клетках пляшут (оглушены), команда точнее и крепче, а гномы в 12 клетках веселеют' },
  ],
  monk: [
    { k: 'flurry', name: 'Шквал ударов', cost: 30, cd: 40, dur: 8, buf: { spd: 0.5 }, desc: '8 с: бьёт вдвое чаще' },
    { k: 'palm', name: 'Удар ладонью', lvl: 3, cost: 20, cd: 12, fx: 'palm', desc: 'Ближайший враг получает удар и 2,5 с не может прийти в себя' },
    { k: 'patience', name: 'Терпеливая оборона', lvl: 6, cost: 25, cd: 40, dur: 10, buf: { dodge: 0.4, red: 0.2 }, desc: '10 с: уходит от 40% ударов, остальные слабее на 20%' },
    { k: 'calm', name: 'Внутренний покой', lvl: 9, passive: { res: 1.5, dodge: 0.05 }, desc: 'Пассивно: энергия копится в 1,5 раза быстрее, уворот +5%' },
    { k: 'windstep', name: 'Шаг ветра', lvl: 11, cost: 15, cd: 15, next: 1.5, fx: 'windstep', desc: 'Рывок к ближайшему врагу на 4 клетки; следующий удар — без промаха и в полтора раза сильнее' },
    { k: 'ult_monk', name: 'Тысяча ударов', lvl: 13, ult: true, cost: 80, cd: 220, dur: 7, buf: { spd: 0.6, dodge: 0.6, dmg: 0.5 }, fx: 'ult_monk', desc: 'Ульта. 7 с: бьёт втрое чаще, уходит от 60% ударов, урон +50%; в начале сносит врагов в 3 клетках' },
  ],
};
// до пяти обычных способностей + ульта (шестая кнопка, клавиша 6; a.ult)
const ABIL_MAX = 6;
const ABIL_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
const ABIL_KEYN = ['1', '2', '3', '4', '5', '6'];
const abKeyN = (a, i) => a && a.ult ? ABIL_KEYN[5] : ABIL_KEYN[i];
// клавиша цифры → номер способности в списке класса (ульта всегда на 6)
function abIdxByKey(H, n) {
  const as = heroAbils(H);
  if (!as) return -1;
  const u = as.findIndex(a => a.ult);
  if (n === 5) return u;
  return n < as.length && !as[n].ult ? n : -1;
}
const ABIL_KEYS_OLD = ['KeyZ', 'KeyX'];                    // прежние клавиши первых двух способностей тоже работают
const kitOn = () => typeof hlOn === 'function' && hlOn();

// ---------- Ресурс класса: мана (маги, друиды, жрецы, барды), ярость (воины, варвары), энергия (лучники, плуты, монахи), вера (паладины) ----------
const ABIL_RES = {
  mana: { name: 'Мана', col: '#4a90e8' },
  rage: { name: 'Ярость', col: '#d8402a' },
  energy: { name: 'Энергия', col: '#e8c040' },
  faith: { name: 'Вера', col: '#f0d880' },
};
const CLS_RES = { warrior: 'rage', barbarian: 'rage', archer: 'energy', rogue: 'energy', monk: 'energy', mage: 'mana', druid: 'mana', priest: 'mana', bard: 'mana', paladin: 'faith' };
function abResKind(H) { return (H && CLS_RES[H.clsKey]) || null; }
function abResMax(H) {
  const k = abResKind(H);
  if (k === 'mana') return typeof hmMax === 'function' ? hmMax(H) : 12 + 3 * heroStats(H).int;
  if (k === 'faith') return 40 + 4 * (H.level || 1);
  return k ? 100 : 0;
}
function abResGet(H) {
  const k = abResKind(H);
  if (!k) return 0;
  if (k === 'mana') return H.mana != null ? H.mana : abResMax(H);
  return H.rs != null ? H.rs : k === 'rage' ? 20 : abResMax(H);
}
function abResAdd(H, n) {
  const k = abResKind(H);
  if (!k) return;
  const v = Math.max(0, Math.min(abResMax(H), abResGet(H) + n));
  if (k === 'mana') H.mana = v; else H.rs = v;
}
// пассивные множители (res, heal, cd): произведение по открытым по уровню пассивкам
function abPassive(H, key, base) {
  const as = heroAbils(H);
  let s = base;
  if (as) for (const a of as) if (a.passive && a.passive[key] != null && (H.level || 1) >= (a.lvl || 1)) s *= a.passive[key];
  return s;
}

function heroAbils(H) { return (H && HERO_ABIL[H.clsKey]) || null; }
function abReady(H, a) { return !a.passive && !((H.abCd || {})[a.k] > Game.time) && (H.level || 1) >= (a.lvl || 1); }
// сумма действующих усилений по ключу (и пассивных способностей)
function heroBuf(u, key) {
  const H = u && u.hero, as = heroAbils(H);
  if (!as) return 0;
  let s = 0;
  const now = Game.time, L = H.level || 1;
  for (const a of as) {
    if (a.buf && a.buf[key] && H.abT && H.abT[a.k] > now) s += a.buf[key];
    else if (a.passive && a.passive[key] && key !== 'res' && key !== 'heal' && key !== 'cd' && L >= (a.lvl || 1)) s += a.passive[key];
  }
  // чужие усиления: щит веры и благословение команды (heroabil.js кладёт их на жителя)
  if (u.abShare && u.abShare.t > now && u.abShare[key]) s += u.abShare[key];
  return s;
}

const kitMirror = () => typeof Coop !== 'undefined' && !!Coop.on;
const kitServer = () => typeof coop !== 'undefined' && !!coop.players;
// сообщение игроку: в общей деревне — только ему, в одиночной — тостом
function abSay(h, text) { const o = h && h.hero && h.hero.owner; if (o && typeof coopSay === 'function' && kitServer()) coopSay(o, text); else toast(text); }

// Кнопка или клавиша способности. В общей деревне — просьба серверу (он проверит и применит), перезарядку видно сразу.
function heroUseAbility(i) {
  const h = Game.hero, H = h && h.hero, as = heroAbils(H);
  if (!as || !h || h.dead) return false;
  if (kitMirror()) {
    H.abCd = h.abcd || {}; H.abT = h.abt || {};
    const a = as[i];
    if (!a) return false;
    if ((H.level || 1) < (a.lvl || 1)) { toast(`${a.name} — с ${a.lvl} уровня героя`); return false; }
    if (a.passive) { toast(`${a.name} — действует всегда`); return false; }
    if (!abReady(H, a)) return false;
    if (a.cost && h.rs != null && h.rs < a.cost) { floater(h.x, h.y - 1.6, 'Не хватает: ' + ABIL_RES[abResKind(H)].name.toLowerCase(), '#9ec8ff'); return false; }
    if ((h._abSent || 0) > Game.time) return false;        // не засыпать сервер повторами, пока ждём ответ
    h._abSent = Game.time + 0.4;
    coopSend({ t: 'abil', i });                           // перезарядку и время действия пришлёт сервер (u.abcd / u.abt)
    return true;
  }
  if (kitOn()) return heroAbilityFor(h, i);
  return false;
}

function heroAbilityFor(h, i) {
  const H = h && h.hero, as = heroAbils(H);
  if (!as || h.dead) return false;
  const a = as[i];
  if (!a) return false;
  if ((H.level || 1) < (a.lvl || 1)) { abSay(h, `${a.name} — с ${a.lvl} уровня героя`); return false; }
  if (a.passive) { abSay(h, `${a.name} — действует всегда`); return false; }
  if (!abReady(H, a)) return false;
  if (H.stunUntil > Game.time || H.downT) { abSay(h, `${H.name} лежит — не до приёмов`); return false; }
  if (h.inside) { abSay(h, `${H.name}: сперва выйти наружу`); return false; }
  const now = Game.time, col = ABIL_COL[a.k] || (GCLS[H.clsKey] || {}).col || '#ffe070';
  const cost = a.cost || 0, rk = abResKind(H);
  if (cost && rk && abResGet(H) < cost) { floater(h.x, h.y - 1.6, 'Не хватает: ' + ABIL_RES[rk].name.toLowerCase(), ABIL_RES[rk].col); return false; }
  if (a.fx && typeof ABIL_FX !== 'undefined' && ABIL_FX[a.fx] && ABIL_FX[a.fx](h, a, H, now) === false) return false;
  if (a.shots || a.turn) {
    // нужны враги рядом — иначе приём не тратится
    const fs = foesNear(h.x, h.y, a.shots ? a.shots.r : 6);
    if (!fs.length) { floater(h.x, h.y - 1.6, 'Врагов рядом нет', '#e8e0c0'); return false; }
    if (a.shots) {
      for (let n = 0; n < a.shots.n; n++) {
        const f = fs[n % fs.length], d = Math.hypot(f.o.x - h.x, f.o.y - h.y);
        G.shots.push({ kind: a.shots.kind, x: h.x, y: h.y - 0.7, f: { kind: f.kind, o: f.o, sure: a.shots.mul }, u: h, t: 0, dur: Math.max(0.25, d / 11) + n * 0.14 });
      }
      h.face = fs[0].o.x > h.x ? 1 : -1; h.vdir = 'E';
      h.hfx = { k: 'strike', t: now + 0.4 };
      sfxAt(a.shots.kind === 'arrow' ? 'thud' : 'chime', h.x * TILE, h.y * TILE, 0.7);
    } else {
      // изгнание нежити: скелеты рядом рассыпаются, ходячие деревья и камни пятятся
      let n = 0;
      for (const f of fs) {
        if (f.kind === 'skel' && Math.random() < 0.45 + 0.03 * H.level) { abForceKill(f, h); n++; }
        else if (f.kind === 'ent' && f.o.state === 'walk') { f.o.state = 'ghosted'; f.o.t = 0; f.o.gFrom = [h.x, h.y]; }
      }
      fxBurst(h.x * TILE, h.y * TILE - 14, 30, ['#fff6c0', '#ffe070', '#ffffff'], 120, 60, 1, 2, -20);
      floater(h.x, h.y - 2, n ? `Изгнано: ${n}` : 'Прочь, нежить!', '#fff2a0');
    }
  }
  if (a.heal) {
    const part = (a.heal + 0.01 * ((H.level || 1) - 1)) * abPassive(H, 'heal', 1);
    H.hp = Math.min(H.maxhp, H.hp + H.maxhp * part); h.injury = null;
    if (a.team) for (const m of abTeam(h, 8)) {
      m.injury = null;
      if (m.rec && m.rec.hp != null) m.rec.hp = Math.min(30 + 8 * m.rec.lvl, m.rec.hp + 15);
      if (m.hero && m.hero.maxhp) m.hero.hp = Math.min(m.hero.maxhp, m.hero.hp + m.hero.maxhp * part * 0.6);
      m.abbu = { k: a.k, s: now };
    }
  }
  if (a.dur) (H.abT || (H.abT = {}))[a.k] = now + a.dur;
  if (a.next) H.abNext = a.next;
  if (cost) abResAdd(H, -cost);
  (H.abCd || (H.abCd = {}))[a.k] = now + a.cd * abPassive(H, 'cd', 1);
  // копии на самом жителе: сервер общей деревни отправляет их игроку — кнопки показывают перезарядку
  if (H.owner) { h.abcd = Object.assign({}, H.abCd); h.abt = Object.assign({}, H.abT); h.rs = Math.round(abResGet(H)); }
  // видимый эффект (уходит игрокам общей деревни вместе с героем): вспышка и, у долгих, свечение на всё время
  h.abbu = { k: a.k, s: now };
  if (a.dur || a.next) h.abfx = { k: a.k, s: now, t: now + (a.dur || 60) };
  if (!a.shots && !a.turn && !a.fx) { h.hfx = { k: 'win0', t: now + 0.55 }; h.vdir = 'E'; }   // вскинул оружие: приём!
  floater(h.x, h.y - 1.9, a.name + '!', col);
  sfxAt(ABIL_SND[a.k] || 'chime', h.x * TILE, h.y * TILE, 0.8);
  if (typeof track === 'function' && !kitServer()) track('abil-' + a.k, 'Способность героя: ' + a.name);
  updateUI(true);
  return true;
}

// команда рядом: напарники героя, его отряд (рекруты «за героем») и другие герои общей деревни
function abTeam(h, r) {
  const out = [];
  for (const m of Game.units) {
    if (m === h || m.dead || m.inside || Math.hypot(m.x - h.x, m.y - h.y) > r) continue;
    if (m.teamOf === h.id || (m.rec && m.rec.order === 'follow') || (m.hero && m.hero.owner)) out.push(m);
  }
  return out;
}

// цвета способностей (вспышка, свечение, надпись) и звуки
const ABIL_COL = {
  bash: '#cfe0ff', cry: '#ffb050', stand: '#c8ccd0', surge: '#ffe070', wall: '#8ac8ff',
  rage: '#ff5a3a', reckless: '#ff9a40', stomp: '#c8964a', hide: '#b08a5a',
  aimed: '#ff6a5a', volley: '#e8d0a0', trap: '#c8a070', eagle: '#f0d080',
  sneak: '#9a8ab8', trip: '#c8b0e0', steal: '#ffd060', vanish: '#8a8aa8', nimble: '#cfe8ff',
  fire: '#ffb050', ward: '#fff0a0', frost: '#9ee0ff', shield: '#8ac8ff', spring: '#6aa6ff',
  thorns: '#8ae070', grow: '#a0e060', mend: '#8ae070', beast: '#c8d8e8', wild: '#c8964a',
  heal: '#9af0a0', cure: '#c0ffd0', bless: '#ffe890', turn: '#fff2a0', mercy: '#fff6c0',
  hands: '#fff0b0', smite: '#ffe060', consecrate: '#ffe890', faith: '#f0e0a0', aura: '#ffd070',
  inspire: '#f0a0d0', chord: '#d8a0ff', five: '#ffd070', voice: '#f0a0d0',
  flurry: '#ffd080', palm: '#ffe0c0', patience: '#f0a8d0', calm: '#c0e0ff',
  roar: '#ff6a3a', leap: '#9ec8ff', sour: '#d8a0ff', windstep: '#c0e0ff',
};
const ABIL_SND = {
  bash: 'parry', cry: 'cheer', surge: 'dash', wall: 'parry', rage: 'roar', stomp: 'rumble', aimed: 'thud', trap: 'click',
  sneak: 'whoosh', trip: 'whiff', steal: 'treasure', vanish: 'whoosh', fire: 'crackle', ward: 'hiss', frost: 'glass', thorns: 'creak', grow: 'chime',
  mend: 'heal', beast: 'roar', wild: 'roar', heal: 'heal', cure: 'heal', hands: 'heal', smite: 'chime', consecrate: 'chime', chord: 'toot', five: 'five',
  inspire: 'pipe', flurry: 'dash', palm: 'slap', roar: 'roar', leap: 'whoosh', sour: 'toot', windstep: 'dash',
};

// ---------- Значки способностей 12×12 (своя пиксельная графика) ----------
const ABIL_ICON = {
  wind: ['R:#e04a3a w:#fff6e0', '............', '.RRR....RRR.', 'RRRRR..RRRRR', 'RRRRRwwRRRRR', 'RRRRRwwRRRRR', 'RRRwwwwwwRRR', 'RRRwwwwwwRRR', '.RRRRwwRRRR.', '..RRRwwRRR..', '...RRRRRR...', '....RRRR....', '.....RR.....'],
  surge: ['Y:#f6d458 o:#c89226', '.......YYYo.', '......YYYo..', '.....YYYo...', '....YYYo....', '...YYYYYYYo.', '..oooYYYYo..', '.....YYYo...', '....YYYo....', '...YYo......', '..YYo.......', '.Yo.........', '............'],
  rage: ['F:#c8302a O:#ff8a30 Y:#ffe070', '.....F......', '....FF......', '....FFF..F..', '...FFFF.FF..', '..FFFOFFFF..', '..FFOOOFFF..', '.FFOOYOOFFF.', '.FFOYYYOOFF.', '.FOOYYYYOFF.', '.FOYYYYYOOF.', '..FOYYYYOF..', '...FFFFFF...'],
  reckless: ['G:#c8ccd0 b:#8a5a30', 'GG........GG', 'GGG......GGG', 'GGGb....bGGG', '.G.bb..bb.G.', '....bbbb....', '.....bb.....', '....bbbb....', '...bb..bb...', '..bb....bb..', '.bb......bb.', 'bb........bb', 'b..........b'],
  missile: ['P:#a070ff W:#f4e8ff', '..P.....P...', '.PWP...PWP..', '..P.....P...', '............', '.....P......', '....PWP.....', '...PWWWP....', '....PWP.....', '.....P......', '..P.........', '.PWP........', '..P.........'],
  shield: ['B:#2c4a9a L:#7aa0ff W:#e8f0ff', '.BBBBBBBBBB.', 'BLLLLLLLLLLB', 'BLBBBBBBBBLB', 'BLBBBWWBBBLB', 'BLBBWBBWBBLB', 'BLBBBWWBBBLB', '.BLBBBBBBLB.', '.BLBBBBBBLB.', '..BLBBBBLB..', '...BLBBLB...', '....BLLB....', '.....BB.....'],
  wild: ['b:#7a4a24 p:#c89a70', '..bb....bb..', '.bppb..bppb.', '.bppb..bppb.', '..bb....bb..', 'bb........bb', 'bpb.bbbb.bpb', '.b.bbbbbb.b.', '..bbppppbb..', '..bppppppb..', '..bppppppb..', '...bppppb...', '....bbbb....'],
  mend: ['G:#5ab04a w:#f0fff0 b:#6a4a28', '........GG..', '......GGGG..', '....GGGGGG..', '...GGGwGGG..', '..GGGwwwGG..', '..GGGGwGGG..', '.GGGGGGGG...', '.GGGGGGG....', '.GGGGGG.....', '..GGG.......', '.b..........', 'b...........'],
  sneak: ['S:#8a909c W:#e8ecf0 g:#c89226 b:#3a2416', '..........SS', '.........SWS', '........SWS.', '.......SWS..', '......SWS...', '.....SWS....', '..g.SWS.....', '..ggWS......', '...gg.......', '..bbgg......', '.bb..g......', 'bb..........'],
  evade: ['W:#cfe8ff B:#7aa0c8', '............', '...WWWWW....', '..W.....B...', '........B...', '..WWWWWW....', '.W..........', '.W....WWWW..', '..BBBB....W.', '..........W.', '....WWWWWW..', '............', '............'],
  aimed: ['R:#c8302a W:#f4f0e4 Y:#f6d458', '....RRRR....', '..RRWWWWRR..', '.RWWRRRRWWR.', '.RWRRWWRRWR.', 'RWRRWRRWRRWR', 'RWRWRYYRWRWR', 'RWRWRYYRWRWR', 'RWRRWRRWRRWR', '.RWRRWWRRWR.', '.RWWRRRRWWR.', '..RRWWWWRR..', '....RRRR....'],
  volley: ['a:#a06840 H:#dcdcd4 r:#e04a3a', 'r...r...r...', '.a...a...a..', '..a...a...a.', '...a...a...a', '....H...H...', '...HHH.HHH..', '..r.........', '...a........', '....a.......', '.....a......', '......H.....', '.....HHH....'],
  flurry: ['F:#e4b08a w:#e8dcc0', '..FFFF..FFFF', '.FFFFFF.FFFF', '.FwwwwF.FwwF', '.FFFFFF.FFFF', '..FFFF...FF.', '............', 'FFFF..FFFF..', 'FFFFF.FFFFF.', 'FwwwF.FwwwF.', 'FFFFF.FFFFF.', '.FFF...FFF..', '............'],
  patience: ['P:#e8a0c0 p:#c86a9a G:#5a9a4a Y:#f6d458', '.....Y......', '....PPP.....', '..p.PPP.p...', '.pPPPPPPPp..', '..pPPPPPp...', '...pPPPp....', 'GGGGGGGGGGG.', '.GGGGGGGGG..', '............', '............', '............', '............'],
  bless: ['Y:#f6d458 W:#fff6c0', '.....Y......', '..Y..Y..Y...', '...Y.Y.Y....', '....YYY.....', 'YYYYYWYYYYY.', '....YYY.....', '...Y.Y.Y....', '..Y..Y..Y...', '.....Y......', '............', '............', '............'],
  // лютня, ладонь, сияющие руки, меч в огне
  inspire: ['b:#8a5a2a o:#c88a4a k:#3a2416 W:#f4e8c8 P:#f0a0d0', '.........kk.', '........kWk.', '.......kWk..', '......kWk...', '..oooo.k..P.', '.obbbbo...PP', 'obbkkbbo..P.', 'obkbbkbo.PP.', 'obbkkbbo.P..', '.obbbbo.....', '..oooo......', '............'],
  five: ['F:#e4b08a f:#b8845a Y:#ffe070', '.F.F.F......', '.F.F.F.F....', '.F.F.F.F....', '.FFFFFFF.Y..', '.FFFFFFF..Y.', '.FFFFFFFF...', '..FFFFFFF.Y.', '..FFFFFF..Y.', '..fFFFFf....', '...fFFf...Y.', '...ffff.....', '............'],
  hands: ['F:#e4b08a W:#fff6c0 Y:#ffe070', '.....Y......', '..Y..W..Y...', '....WWW.....', '.Y.WWWWW.Y..', '............', 'FF.......FF.', 'FFF.....FFF.', '.FFF...FFF..', '..FFF.FFF...', '...FFFFF....', '....FFF.....', '............'],
  smite: ['S:#c8ccd0 W:#fff6c0 Y:#ffe070 O:#ff9a30 b:#6a4a28', 'Y.........YO', '.........SWO', '..Y.....SWS.', '.......SWS..', '......SWS.Y.', '.....SWS....', '..b.SWS.....', '..bbWS......', '...bb.......', '..bb.b...Y..', '.bb.........', 'Y...........'],
  turn: ['W:#e6dfc8 k:#2a2420 Y:#fff2a0', 'Y....YY....Y', '...WWWWWW...', '..WWWWWWWW..', '.WWWWWWWWWW.', '.WWkkWWkkWW.', '.WWkkWWkkWW.', '.WWWWkkWWWW.', '..WWWWWWWW..', '...WkWkWkW..', '...WWWWWW...', 'Y..........Y', '............'],
};
// Единый поиск значка по ключу способности: ABIL_ICON (здесь и в heroabil.js), HC_ICON (herocard.js), синонимы;
// нет значка — запасной (руна в круге), чтобы ячейка никогда не была пустой. Проверка: tests/icon-test.js
const ABIL_ICON_ALIAS = { g_strike: 'strike', u_atk: 'strike', u_home: 'tp', drink: 'u_eat' };
const ABIL_ICON_DEF = ['Y:#f6d458 o:#a87a1c W:#fff6c0', '....oooo....', '..oo....oo..', '.o...YY...o.', '.o..YWWY..o.', 'o..YWYYWY..o', 'o..YYWWYY..o', 'o...YWWY...o', 'o....YY....o', '.o........o.', '.o...YY...o.', '..oo....oo..', '....oooo....'];
function abilIconGlyph(k) {
  const hc = typeof HC_ICON !== 'undefined' ? HC_ICON : {}, al = ABIL_ICON_ALIAS[k];
  return ABIL_ICON[k] || hc[k] || (al && (ABIL_ICON[al] || hc[al])) || ABIL_ICON_DEF;
}
const ABIL_ICON_URL = {};
function abilIconURL(k) {
  if (ABIL_ICON_URL[k]) return ABIL_ICON_URL[k];
  const g = abilIconGlyph(k);
  if (!g || typeof document === 'undefined' || !document.createElement) return '';
  const pal = {};
  for (const p of g[0].split(' ')) { const [ch, col] = p.split(':'); pal[ch] = col; }
  const cv = mkCanvas(14, 14), c = cv.getContext('2d');
  const px = (x, y) => (g[1 + y] || '')[x] || '.';   // у части глифов 11 строк — недостающая строка пустая (иначе панель падала каждый кадр)
  const on = (x, y) => y >= 0 && y < 12 && x >= 0 && x < 12 && px(x, y) !== '.';
  // тёмный контур вокруг силуэта — читается на любом фоне
  c.fillStyle = '#1a1008';
  for (let y = -1; y <= 12; y++) for (let x = -1; x <= 12; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) c.fillRect(x + 1, y + 1, 1, 1);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const ch = px(x, y); if (ch !== '.') { c.fillStyle = pal[ch] || '#fff'; c.fillRect(x + 1, y + 1, 1, 1); } }
  return (ABIL_ICON_URL[k] = cv.toDataURL());
}

// ---------- Значки вещей в рюкзаке: то же оружие, что в руке у героя ----------
{
  const _dgi = drawGoodIcon;
  drawGoodIcon = function (c, g, x, y) {
    const K = KIT_ITEMS[g];
    if (!K) return _dgi(c, g, x, y);
    c.save(); c.translate(x, y);
    const st = WPN_STYLE[K.w];
    if (K.w === 'wshield') { c.translate(8, 8); c.scale(1.5, 1.5); drawShield(c, 0, 0, 3.2, 3.9); }
    else if (st === 'bow') { c.translate(8, 8); c.scale(1.3, 1.3); drawBow(c, K.w, 0.6, 0, 0.78, null); }
    else if (st === 'fist') {
      c.translate(8, 8); c.scale(1.4, 1.4);
      for (const [fx, fy] of [[-2.2, 1.2], [2.2, -1.2]]) { ellipse(c, fx, fy, 2.4, 2.2, '#e4b08a'); for (const k of [-0.8, 0.5]) line(c, fx - 2.2, fy + k, fx + 2.2, fy + k, '#e8dcc0', 0.6); }
    } else {
      // клинки и древки — по диагонали снизу слева вверх направо
      const len = st === 'stab' ? 6 : st === 'heavy' ? 11 : st === 'staff' ? 13 : 10.5, sc = 18 / len;
      c.translate(3, 13); c.scale(sc * 0.72, sc * 0.72);
      const back = st === 'heavy' ? 3.4 : st === 'staff' ? 4.6 : 1.7;
      drawWeapon(c, K.w, back * 0.7071, -back * 0.7071, 0.7071, -0.7071);
    }
    c.restore();
  };
}

// ---------- Подключение: характеристики, удары, урон по герою ----------
const KIT = { t: 0, hooked: false };
// поля жителя, которые сервер общей деревни отправляет игрокам: кадр удара/парирования, вспышка и свечение способности
const KIT_SYNC = ['hfx', 'abfx', 'abbu', 'abcd', 'abt', 'rs', 'rsm', 'abShare'];

{
  // левая рука (щит, второй кинжал) тоже даёт бонус
  const _st = heroStats;
  heroStats = function (h) {
    const s = _st(h);
    const b = h && h.equip && GEAR_BONUS[h.equip.off];
    if (b) for (const k of ['str', 'agi', 'int', 'end']) if (b[k]) s[k] += b[k];
    return s;
  };
  // своё оружие первого уровня бьёт в полную силу, как оружие класса
  const _atk = heroAtk;
  heroAtk = function (u) {
    let p = _atk(u);
    const H = u.hero, w = H.equip && H.equip.weapon, o = H.equip && H.equip.off;
    if (kitMine(H, w)) p += KIT_ITEMS[w].atk * 0.5;
    if (o && GEAR_BONUS[o] && GEAR_BONUS[o].atk) p += GEAR_BONUS[o].atk;
    return Math.min(0.95, p);
  };
  const _def = heroDef;
  heroDef = function (u) { const o = u.hero.equip && GEAR_BONUS[u.hero.equip.off]; return _def(u) + (o && o.def ? o.def : 0); };
  // точность и урон под усилениями
  const _ua = unitAtk;
  unitAtk = function (u) { const a = _ua(u); return u.type === 'hero' && u.hero ? Math.min(0.97, a * (1 + heroBuf(u, 'atk'))) : a; };
  if (typeof neuDamageOf === 'function') {
    const _nd = neuDamageOf;
    neuDamageOf = function (u) { return _nd(u) * (u.type === 'hero' && u.hero ? 1 + heroBuf(u, 'dmg') : 1); };
  }

  // Крепость ночной нечисти в бою с героем и рекрутами: сколько попаданий держит скелет или ходячее дерево
  const foeHits = f => f.kind === 'skel' ? Math.max(1, Math.round(nightDiff() * 0.9)) : f.kind === 'ent' ? Math.max(1, Math.round(nightDiff())) : 1;
  const _kill = killFoe;
  killFoe = function (f, u) {
    const o = f && f.o;
    if (o && (f.kind === 'skel' || f.kind === 'ent') && !KIT.force) {
      if (o.nhp == null) o.nhp = foeHits(f);
      if (--o.nhp > 0) {
        floater(o.x, o.y - 1.8, `Держится! (${o.nhp})`, '#e8e0c0');
        fxBurst(o.x * TILE, o.y * TILE - 12, 8, f.kind === 'skel' ? ['#e6dfc8', '#c8c0a4'] : ['#8a6a3a', '#c8a070'], 55, 40, 0.5, 1.5, 200);
        sfxAt(f.kind === 'skel' ? 'rattle' : 'chop', o.x * TILE, o.y * TILE, 0.7);
        if (f.kind === 'ent') { o.hitT = Game.time; if (o.rock) rockCrack(o); }
        return;
      }
    }
    _kill(f, u);
  };
  KIT.kill = killFoe;

  const _strike = strike;
  strike = function (u, f) {
    const H = u && u.type === 'hero' && u.hero;
    if (!H || !foeAlive(f)) return _strike(u, f);
    // без промаха: «скрытая атака», «меткий выстрел», искры и стрелы способностей
    const sure = f.sure || H.abNext || 0;
    if (sure) {
      if (!f.sure) { H.abNext = 0; if (u.abfx && (u.abfx.k === 'sneak' || u.abfx.k === 'aimed')) u.abfx = null; }
      const o = f.o;
      floater(o.x, o.y - 2, sure >= 2 ? 'Точно в цель!' : 'В цель!', '#ffe070');
      if (f.kind === 'neu') neuHit(o, u, neuDamageOf(u) * sure * (0.9 + Math.random() * 0.2));
      else if (sure >= 2) abForceKill(f, u);
      else killFoe(f, u);
      if (f.sure) fxBurst(o.x * TILE, o.y * TILE - 12, 10, ['#c8a0ff', '#f4e8ff'], 60, 40, 0.5, 1.5, 120);
      return;
    }
    _strike(u, f);
    // поздней ночью нечисть отвечает и на попадания: чаще и больнее
    if (foeAlive(f) && (f.kind === 'skel' || f.kind === 'ent')) {
      const d = nightDiff(), C = GCLS[unitCls(u)];
      if (!(C && C.shot) && Math.random() < 0.1 * (d - 1)) heroHit(u, 3 + 2.5 * d, f.kind === 'skel' ? 'Скелет рубит!' : 'Ветвью наотмашь!');
    }
  };
}

// убить сразу, минуя «держится»
function abForceKill(f, u) { KIT.force = true; try { killFoe(f, u); } finally { KIT.force = false; } }

// Урон по герою от врагов: уклонение, щит, ослабление усилениями — и кадр «получил удар» / «парировал»
function heroDodge(u) {
  const H = u.hero;
  let p = heroBuf(u, 'dodge');
  if (H.equip && H.equip.off === 'woodShield') p += 0.08;      // щит иногда принимает удар на себя
  return Math.min(0.75, p);
}
function heroHit(u, n, say) {
  if (u.dead) return;
  if (Math.random() < heroDodge(u)) { heroParry(u); return; }
  n *= 1 - Math.max(-0.5, Math.min(0.85, heroBuf(u, 'red')));
  if (say) floater(u.x, u.y - 2.1, say, '#ff9a80');
  if (typeof hlHurt === 'function' && kitOn()) { KIT.inHit = true; try { hlHurt(u, n, 'hit'); } finally { KIT.inHit = false; } }
  else if (u.hero.owner) { u.hero.hp = Math.max(0, u.hero.hp - n); floater(u.x, u.y - 1.8, '−' + Math.round(n), '#ff8a70'); }
  u.hfx = { k: 'hurt', t: Game.time + 0.35 };
}
function heroParry(u) {
  u.hfx = { k: 'parry', t: Game.time + 0.4 };
  floater(u.x, u.y - 1.9, u.hero.equip && u.hero.equip.off === 'woodShield' ? 'Щитом!' : 'Уклонился!', '#cfe8ff');
  fxBurst(u.x * TILE + (u.face || 1) * 6, u.y * TILE - 14, 6, ['#ffffff', '#cfe8ff'], 40, 20, 0.3, 1.3, 120);
  sfxAt('thud', u.x * TILE, u.y * TILE, 0.4);
}

{
  // удары нейтралов, скелетов (ответный удар в guilds.js) и прочие боевые раны: через уклонение и усиления
  if (typeof hlHurt === 'function') {
    const _hh = hlHurt;
    hlHurt = function (u, n, why) {
      if (why === 'hit' && u && u.hero && !KIT.inHit) {
        if (Math.random() < heroDodge(u)) { heroParry(u); return; }
        n *= 1 - Math.max(-0.5, Math.min(0.85, heroBuf(u, 'red')));
        u.hfx = { k: 'hurt', t: Game.time + 0.35 };
      }
      KIT.inHit = true;
      try { _hh(u, n, why); } finally { KIT.inHit = false; }
    };
  }
  if (typeof neuHurtUnit === 'function') {
    const _nh = neuHurtUnit;
    neuHurtUnit = function (u, n) {
      if (u && u.hero && !u.dead) {
        if (Math.random() < heroDodge(u)) { heroParry(u); return; }
        n *= 1 - Math.max(-0.5, Math.min(0.85, heroBuf(u, 'red')));
        if (n >= 1) u.hfx = { k: 'hurt', t: Game.time + 0.35 };
      } else if (u && u.rec && !u.dead && n >= 1) u.hfx = { k: 'hurt', t: Game.time + 0.35 };
      _nh(u, n);
    };
  }
  // увернулся от нейтрала сам (neutrals.js) — показать парирование
  if (typeof neuStrike === 'function') {
    const _ns = neuStrike;
    neuStrike = function (N, tg) {
      const hpOf = t => (t && t.hero ? t.hero.hp : t && t.rec ? t.rec.hp : null);
      const hp = hpOf(tg);
      _ns(N, tg);
      if (hp != null && hpOf(tg) === hp && !tg.dead && !(tg.hfx && tg.hfx.t > Game.time)) tg.hfx = { k: 'parry', t: Game.time + 0.35 };
    };
  }

  // Анимация боя героя: выхватить оружие → замах → удар → довод → стойка … → победа
  // Бой героя и рекрутов: выхватить → замах → удар → довод → стойка … → победа (только если враг пал)
  const heroFightWrap = (inner, u, isAlive, died) => (function* () {
    const H = u.hero;
    const had = isAlive();
    if (had && !(u.combatUntil > Game.time) && !u._wo) {
      // оружие ещё в ножнах — выхватить (уже в руке, потому что рядом нечисть, — сразу в бой)
      u.combatUntil = Game.time + 8; u._wo = true; u._wanim = null;
      yield { wait: WPN_DRAW_T, anim: 'fdraw' };
    }
    let r = inner.next(), after = 0;
    while (!r.done) {
      let v = r.value;
      u.combatUntil = Game.time + 8;
      if (v && v.wait != null && !v.walk) { v = fightAnim(u, v, after); after = v._after; }
      r = inner.next(yield v);
    }
    if (had && died() && !u.dead && !(H && H.hp <= 0) && !(u.rec && u.rec.hp != null && u.rec.hp <= 0) && !u.brk) {
      floater(u.x, u.y - 2, (u.rec ? ['Есть!', 'Готов!', 'За гильдию!'] : ['Ха!', 'Следующий!', 'Вот так!', 'За деревню!'])[(Math.random() * (u.rec ? 3 : 4)) | 0], '#fff2a0');
      yield { wait: 1.3, anim: 'fwin' };
    }
  })();
  // рабочие кадры боевых генераторов → боевые: топор/молот — удар, пригнулся — парирование, пауза — довод или стойка
  function fightAnim(u, v, after) {
    const fast = 1 - Math.min(0.6, heroBuf(u, 'spd'));
    if (v.anim === 'chop' || v.anim === 'build') return Object.assign({}, v, { anim: 'fatk', wait: v.wait * fast, _after: 1 });
    if (v.anim === 'duck') return Object.assign({}, v, { anim: 'fparry', _after: 0 });
    if (!v.anim) return Object.assign({}, v, { anim: after === 1 ? 'ffollow' : 'fready', wait: v.wait * fast, _after: 2 });
    return Object.assign({}, v, { _after: 0 });
  }
  const foeDied = f => {
    const o = f.o;
    if (f.kind === 'skel') return o.state === 'dead';
    if (f.kind === 'ent') return o.state === 'dying' || o.state === 'gone';
    if (f.kind === 'neu') return o.st === 'die' || !Game.neutrals.includes(o);
    if (f.kind === 'beast') return !!o.dead || !Game.animals.includes(o);
    return false;
  };
  const isFighter = u => (u.type === 'hero' && !!u.hero) || !!u.rec;

  const _fg = fightGen;
  fightGen = function (u, f) {
    if (!isFighter(u) || !f || !f.kind) return _fg(u, f);
    return heroFightWrap(_fg(u, f), u, () => foeAlive(f), () => foeDied(f));
  };
  // если героя затянуло в ночную драку как простого гнома — те же кадры
  if (typeof skelFightGen === 'function') {
    const _sf = skelFightGen;
    skelFightGen = function (u, s) { return u.type === 'hero' && u.hero ? heroFightWrap(_sf(u, s), u, () => s.state === 'fight' || s.state === 'roam', () => s.state === 'dead') : _sf(u, s); };
  }
  if (typeof entFightGen === 'function') {
    const _ef = entFightGen;
    entFightGen = function (u, e) { return u.type === 'hero' && u.hero ? heroFightWrap(_ef(u, e), u, () => e.state === 'fight' || e.state === 'walk', () => e.state === 'dying' || e.state === 'gone') : _ef(u, e); };
  }
  // тренировка с главой и учебные удары рекрутов во дворе гильдии — теми же боевыми кадрами
  if (typeof recruitGen === 'function') {
    const _rg = recruitGen;
    recruitGen = function (u) {
      const inner = _rg(u);
      return (function* () {
        let r = inner.next(), after = 0;
        while (!r.done) {
          let v = r.value;
          const conv = v && v.wait != null && !v.walk && (v.anim === 'chop' || v.anim === 'build' || v.anim === 'duck' || (!v.anim && after === 1 && v.wait <= 0.6));
          if (conv) { v = fightAnim(u, v, after); after = v._after; } else after = 0;
          r = inner.next(yield v);
        }
      })();
    };
  }

  // своё оружие первого уровня надевается с первого раза
  const _run = runCmd;
  runCmd = function* (u, c) {
    if (c.kind === 'equip' && u.hero && u.hero.inv && u.hero.inv[c.slot] && kitMine(u.hero, u.hero.inv[c.slot].k) && typeof quickEquipGen === 'function') yield* quickEquipGen(u, c);
    else yield* _run(u, c);
  };

  // ускорение под способностями
  const _sm = teamSpeedMul;
  teamSpeedMul = function (u) { return _sm(u) * (u.type === 'hero' && heroBuf(u, 'regen') ? 1.1 : 1); };

  const _ab = heroAbility;
  heroAbility = function (k) {
    if (/^ab\d$/.test(k)) { heroUseAbility(+k.slice(2)); return; }
    if (k === 'uno') {
      const H = Game.hero && Game.hero.hero;
      if (H && H.equip.off) { if (hlAddItem(H, H.equip.off, 1)) { H.equip.off = null; updateUI(true); } else toast('Рюкзак полон'); }
      return;
    }
    _ab(k);
  };

  const _step = step;
  step = function (dt) { _step(dt); kitTick(dt); };

  const _reset = resetGameState;
  resetGameState = function () { _reset(); KIT.t = 0; };

  const _start = startGame;
  startGame = function () {
    _start();
    // клиент общей деревни: кадры «удар по нему / парировал» приходят вместе с жителями
    if (typeof COOP_UNIT_EX !== 'undefined') for (const k of KIT_SYNC) if (!COOP_UNIT_EX.includes(k)) COOP_UNIT_EX.push(k);
    if (!KIT.keys && typeof window !== 'undefined' && window.addEventListener) {
      KIT.keys = true;
      window.addEventListener('keydown', e => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        let i = ABIL_KEYS.indexOf(e.code);
        if (i >= 0) i = Game.hero ? abIdxByKey(Game.hero.hero, i) : -1;
        else i = ABIL_KEYS_OLD.indexOf(e.code);
        if (i >= 0 && Game.hero) heroUseAbility(i);
      });
    }
  };

  // карточка героя: способности класса и левая рука
  const _hcu = heroCardUpdate;
  heroCardUpdate = function () {
    _hcu();
    const card = typeof document !== 'undefined' && document.getElementById && document.getElementById('hero-card');
    if (!card || card.style.display === 'none' || !Game.hero || !(kitOn() || kitMirror())) return;
    const H = Game.hero.hero;
    if (kitMirror()) { H.abCd = Game.hero.abcd || {}; H.abT = Game.hero.abt || {}; }   // перезарядки — с сервера
    if (Mobile.on && !heroCardOpen) {
      // телефон, тонкая плашка: способности — на панели быстрых способностей (heroabil.js), в плашке их не дублируем
      const el = card.querySelector('.hc-abm');
      if (el) el.remove();
      return;
    }
    let el = card.querySelector('.hc-abil');
    if (!el) { el = document.createElement('div'); el.className = 'hc-abil'; const at = card.querySelector('.hc-guild') || card.querySelector('.tip'); at ? at.after(el) : card.appendChild(el); el.dataset.h = ''; }
    const html = kitAbilHTML(H);
    if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
  };

  // в herolife.js панель строит строку «Оружие · Доспех»; левую руку добавляем рядом
  if (typeof heroPanel === 'function') {
    const _hp = heroPanel;
    const kitPanel = function () {
      let html = _hp();
      if (!kitOn()) return html;
      const H = Game.hero.hero;
      const off = H.equip.off ? `<div class="irow small"><span>Левая рука: <b>${hlName(H.equip.off)}</b></span> <button data-hero="uno" class="hp-sm">снять</button></div>` : '';
      if (off) html = html.replace(/(<div class="irow small">Оружие:[\s\S]*?<\/div>)/, `$1${off}`);
      return html;
    };
    heroPanel = kitPanel;
    const _sg = startGame;
    startGame = function () {
      _sg();
      const cur = heroPanel;
      if (cur !== kitPanel) heroPanel = function () { return (typeof Coop !== 'undefined' && Coop.on) ? cur() : kitPanel(); };
    };
  }

  // Сам герой под способностью: в «Скрытой атаке» полупрозрачен, в «Диком облике» крупнее (медвежья стать),
  // в «Увёртливости» и «Терпеливой обороне» двоится — за ним тянутся тени
  if (typeof drawUnit === 'function') {
    const _du = drawUnit;
    drawUnit = function (c, u) {
      const fx = u.abfx;
      if (!fx || !(fx.t > Game.time) || u.inside || u.dead) return _du(c, u);
      const k = fx.k, t = Game.time;
      if (k === 'sneak') { c.save(); c.globalAlpha = 0.42 + 0.08 * Math.sin(t * 5); _du(c, u); c.restore(); return; }
      if (k === 'wild') {
        const px = Math.round(u.x * TILE), py = Math.round(u.y * TILE + 6), sc = 1.22 + 0.03 * Math.sin(t * 3);
        c.save(); c.translate(px, py); c.scale(sc, sc); c.translate(-px, -py); _du(c, u); c.restore(); return;
      }
      if (k === 'evade' || k === 'patience') {
        const dx = (u.face || 1) * -3;
        for (const [o, a] of [[2, 0.18], [1, 0.3]]) { c.save(); c.globalAlpha = a; c.translate(dx * o + Math.sin(t * 17 + o) * 0.8, 0); _du(c, u); c.restore(); }
      }
      _du(c, u);
    };
  }

  // свечение и вспышки способностей поверх мира — по полям жителя (в общей деревне они приходят с сервера)
  const _ov = drawOverlay;
  drawOverlay = function (c) {
    _ov(c);
    const t = Game.time;
    for (const u of Game.units) {
      if (u.dead || u.inside || !(u.abfx || u.abbu)) continue;
      if (u.abfx && u.abfx.t > t) drawAbilAura(c, u, u.abfx.k, t - u.abfx.s, u.abfx.t - t);
      if (u.abbu && t - u.abbu.s < 1.1) drawAbilBurst(c, u, u.abbu.k, (t - u.abbu.s) / 1.1);
    }
  };
}

// Вспышка в момент приёма: кольцо по земле, свет, у каждого приёма свой узор
function drawAbilBurst(c, u, k, p) {
  const px = u.x * TILE, py = u.y * TILE, col = ABIL_COL[k] || '#ffe070', rgb = hexRgbStr(col);
  c.save(); c.globalCompositeOperation = 'lighter';
  c.strokeStyle = `rgba(${rgb},${0.85 * (1 - p)})`; c.lineWidth = 2;
  c.beginPath(); c.ellipse(px, py + 5, 6 + 20 * p, 2.5 + 8 * p, 0, 0, 7); c.stroke();
  glow(c, px, py - 12, 10 + 14 * p, rgb, 0.45 * (1 - p));
  if (k === 'wind' || k === 'mend' || k === 'bless') {
    // лечение: крестики и листья поднимаются вихрем
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * 6.28 + p * 5, r = 9 - p * 3, yy = py - 4 - p * 26 - i * 2.5;
      c.fillStyle = `rgba(${rgb},${0.9 * (1 - p)})`;
      const x = px + Math.cos(a) * r;
      if (k === 'mend') { c.beginPath(); c.ellipse(x, yy, 2, 1.1, a, 0, 7); c.fill(); }
      else { c.fillRect(x - 0.6, yy - 2, 1.2, 4); c.fillRect(x - 2, yy - 0.6, 4, 1.2); }
    }
  } else if (k === 'turn') {
    // столб света
    const g = c.createLinearGradient(0, py - 70, 0, py + 6);
    g.addColorStop(0, 'rgba(255,240,180,0)'); g.addColorStop(0.7, `rgba(255,240,170,${0.6 * (1 - p)})`); g.addColorStop(1, 'rgba(255,255,220,0)');
    c.fillStyle = g; c.fillRect(px - 10 - 30 * p, py - 70, 20 + 60 * p, 76);
  } else if (k === 'rage' || k === 'reckless') {
    // рёв: красные волны от головы
    for (let i = 0; i < 3; i++) { const q = (p * 1.4 + i / 3) % 1; c.strokeStyle = `rgba(${rgb},${0.7 * (1 - q)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(px, py - 26, 4 + q * 18, -2.6, -0.5); c.stroke(); }
  } else if (k === 'wild') {
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; c.fillStyle = `rgba(200,150,74,${0.8 * (1 - p)})`; c.fillRect(px + Math.cos(a) * (6 + 16 * p), py - 10 + Math.sin(a) * (4 + 10 * p), 2, 2); }
  }
  c.restore();
}

// Пока действует: у каждого приёма своё свечение (left — сколько секунд осталось, на исходе мерцает)
function drawAbilAura(c, u, k, el, left) {
  const px = u.x * TILE, py = u.y * TILE, t = Game.time, col = ABIL_COL[k] || '#ffe070', rgb = hexRgbStr(col);
  const fade = left < 2 ? (Math.floor(t * 8) % 2 ? 0.4 : 1) : 1;
  c.save();
  if (k === 'shield') {
    // магический щит: прозрачный пузырь с бегущими по нему рунами
    c.globalCompositeOperation = 'lighter';
    const hit = u.hfx && u.hfx.t > t ? 1 : 0;
    c.fillStyle = `rgba(120,180,255,${(0.1 + 0.25 * hit) * fade})`; c.beginPath(); c.ellipse(px, py - 10, 11, 16, 0, 0, 7); c.fill();
    c.strokeStyle = `rgba(160,210,255,${(0.55 + 0.4 * hit) * fade})`; c.lineWidth = 1; c.stroke();
    for (let i = 0; i < 5; i++) { const a = t * 1.6 + i * 1.256; c.fillStyle = `rgba(230,245,255,${0.8 * fade})`; c.fillRect(px + Math.cos(a) * 11 - 0.5, py - 10 + Math.sin(a) * 16 - 0.5, 1.2, 1.2); }
  } else if (k === 'rage' || k === 'reckless') {
    // ярость: красное зарево и пар из-под колпака
    c.globalCompositeOperation = 'lighter';
    glow(c, px, py - 12, 16 + 2 * Math.sin(t * 9), rgb, (k === 'rage' ? 0.32 : 0.22) * fade);
    if (Math.random() < 0.25) fxBurst(px + (Math.random() - 0.5) * 6, py - 30, 1, k === 'rage' ? ['#ffb0a0', '#ffffff'] : ['#ffc080'], 8, 26, 0.7, 1.6, -40);
  } else if (k === 'wild') {
    c.globalCompositeOperation = 'lighter';
    glow(c, px, py - 8, 15, '200,150,74', 0.22 * fade);
    if (Math.random() < 0.15) fxBurst(px + (Math.random() - 0.5) * 14, py - Math.random() * 18, 1, ['#8ad060', '#c8964a'], 12, 14, 0.9, 1.6, 40);   // листья и шерсть
  } else if (k === 'sneak') {
    // скрытая атака: дымка и тень под ногами
    c.fillStyle = 'rgba(20,16,30,0.35)'; c.beginPath(); c.ellipse(px, py + 6, 10, 3.5, 0, 0, 7); c.fill();
    if (Math.random() < 0.3) fxBurst(px + (Math.random() - 0.5) * 12, py - Math.random() * 14, 1, ['#3a3448', '#5a5068'], 6, 10, 0.8, 2, -20);
  } else if (k === 'aimed') {
    // меткий выстрел: прицел над головой
    const r = 4 + Math.sin(t * 6) * 0.8, cy = py - 46;
    c.strokeStyle = `rgba(255,90,80,${0.9 * fade})`; c.lineWidth = 0.9;
    c.beginPath(); c.arc(px, cy, r, 0, 7); c.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.beginPath(); c.moveTo(px + dx * (r - 1.5), cy + dy * (r - 1.5)); c.lineTo(px + dx * (r + 2), cy + dy * (r + 2)); c.stroke(); }
  } else if (k === 'surge' || k === 'flurry') {
    // скорость: светлые черты позади
    c.globalCompositeOperation = 'lighter';
    const b = -(u.face || 1);
    for (let i = 0; i < 4; i++) { const yy = py - 6 - i * 6 + Math.sin(t * 13 + i) * 1.2, len = 6 + ((t * 30 + i * 7) % 8); c.strokeStyle = `rgba(${rgb},${0.55 * fade})`; c.lineWidth = 1; c.beginPath(); c.moveTo(px + b * 6, yy); c.lineTo(px + b * (6 + len), yy); c.stroke(); }
  } else if (k === 'evade' || k === 'patience') {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) { const a = t * 4 + i * 3.14; c.strokeStyle = `rgba(${rgb},${0.5 * fade})`; c.lineWidth = 1; c.beginPath(); c.ellipse(px, py - 8, 10, 14, 0, a, a + 1.6); c.stroke(); }
  } else if (k === 'bless') {
    // благословение: золотой нимб над колпаком
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(255,232,140,${0.85 * fade})`; c.lineWidth = 1.4; c.beginPath(); c.ellipse(px, py - 44 + Math.sin(t * 3), 6, 2, 0, 0, 7); c.stroke();
    if (Math.random() < 0.15) fxBurst(px + (Math.random() - 0.5) * 12, py - 40, 1, ['#fff6c0'], 8, 10, 0.8, 1.2, 30);
  } else {
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(${rgb},${(0.35 + 0.15 * Math.sin(t * 7)) * fade})`; c.lineWidth = 1.2; c.beginPath(); c.ellipse(px, py + 6, 11, 4.5, 0, 0, 7); c.stroke();
  }
  c.restore();
}

function hexRgbStr(hex) {
  const h = String(hex || '#ffe070').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function kitAbilButtons(H, mini) {
  const as = heroAbils(H);
  if (!as) return '';
  return as.map((a, i) => {
    const lock = (H.level || 1) < (a.lvl || 1), cd = Math.max(0, Math.ceil(((H.abCd || {})[a.k] || 0) - Game.time));
    const on = (H.abT || {})[a.k] > Game.time;
    const tip = `${a.name} (${abKeyN(a, i)}): ${a.desc}${a.passive ? '' : `. Перезарядка ${a.cd} с`}${a.lvl > 1 ? `, с ${a.lvl} уровня` : ''}`;
    const img = `<img src="${abilIconURL(a.k)}" alt="">`;
    if (mini) return `<button class="hp-ab hk-ab${on ? ' on' : ''}" data-hero="ab${i}" ${lock || cd ? 'disabled' : ''} title="${tip}">${img}<span>${lock ? `с ${a.lvl} ур.` : cd ? cd + ' с' : a.name}</span></button>`;
    return `<button class="hk-big${on ? ' on' : ''}" data-hero="ab${i}" ${lock || cd ? 'disabled' : ''} title="${tip}">${img}<span><b>${a.name}</b><small>${lock ? `с ${a.lvl} уровня` : cd ? `перезарядка ${cd} с` : on ? 'действует' : `${a.passive ? 'пассивно' : abKeyN(a, i)} · ${a.desc}`}</small></span></button>`;
  }).join('');
}

function kitAbilHTML(H) {
  const C = GCLS[H.clsKey];
  if (!heroAbils(H)) return '<div class="irow small muted">Способности класса появятся, когда герой выучится в гильдии</div>';
  return `<div class="irow small muted">Способности: ${C ? C.name.toLowerCase() : ''}</div><div class="hk-list">${kitAbilButtons(H, false)}</div>`;
}

// ---------- Такт ----------

function kitTick(dt) {
  const now = Game.time;
  // отжившие вспышки и свечения — снять, чтобы не гонять их игрокам общей деревни
  if (!kitMirror()) for (const u of Game.units) {
    if (u.abbu && now - u.abbu.s > 1.5) u.abbu = null;
    if (u.abfx && !(u.abfx.t > now)) u.abfx = null;
    if (u.abcd && !Object.values(u.abcd).some(v => v > now)) u.abcd = null;
    if (u.abt && !Object.values(u.abt).some(v => v > now)) u.abt = null;
  }
  // сервер общей деревни: кадры удара уходят игрокам; оружие класса — сразу в руках (рюкзака с надеванием там нет)
  if (typeof coop !== 'undefined' && coop.players) {
    if (!KIT.hooked && typeof COOP_UNIT_EX !== 'undefined') {
      KIT.hooked = true;
      for (const k of KIT_SYNC) if (!COOP_UNIT_EX.includes(k)) COOP_UNIT_EX.push(k);
      // способность от игрока: { t: 'abil', i } — сервер сам проверяет уровень, перезарядку и врагов рядом
      const _cc = coopCmd;
      coopCmd = function (name, json, admin) {
        let m = null;
        try { m = JSON.parse(json); } catch (e) { return; }
        if (m && m.t === 'abil') { const u = coop.players.get(name); if (u && Number.isInteger(m.i) && m.i >= 0 && m.i < ABIL_MAX) heroAbilityFor(u, m.i); return; }
        return _cc(name, json, admin);
      };
    }
    for (const u of coop.players.values()) {
      const H = u.hero, ks = H && KIT_OF[H.clsKey];
      if (!ks || H.kitEq === H.clsKey) continue;
      H.equip = H.equip || { weapon: null, armor: null };
      for (const k of ks) if (!H.equip[KIT_ITEMS[k].slot]) H.equip[KIT_ITEMS[k].slot] = k;
      H.kitEq = H.clsKey;
    }
  }
  const h = Game.hero;
  if (!kitOn() || !h || h.dead || !h.hero) return;
  const H = h.hero;
  // лечение под «Диким обликом» и пассивками — в heroabil.js (abTick), для всех героев
  KIT.t += dt;
  if (KIT.t < 1) return;
  KIT.t = 0;
  // новый класс — новое оружие первого уровня в рюкзак (раз на класс; старые сохранения тоже получат)
  const ks = KIT_OF[H.clsKey];
  if (ks && H.mastery != null && !(H.kitGot || []).includes(H.clsKey)) {
    const free = H.inv.filter(s => !s).length;
    if (free < ks.length) { if (!KIT.fullT || now > KIT.fullT) { KIT.fullT = now + 60; toast(`${H.name}: освободите в рюкзаке ${ks.length} места — гильдия выдаст оружие`); } return; }
    for (const k of ks) hlAddItem(H, k, 1);
    (H.kitGot || (H.kitGot = [])).push(H.clsKey);
    const names = ks.map(k => KIT_ITEMS[k].name.toLowerCase()).join(' и ');
    toast(`${H.name} получил оружие ученика: ${names}. Кликните по вещи в рюкзаке, чтобы надеть (${ks.map(kitBonusText).join('; ')})`);
    logEvent('people', `${H.name} получил: ${names}`, h.x, h.y);
    floater(h.x, h.y - 2, 'Оружие ученика!', '#ffe070');
    updateUI(true);
  }
}

// стили: способности в карточке героя
if (typeof document !== 'undefined' && document.createElement && document.head && document.head.appendChild) {
  const st = document.createElement('style');
  st.textContent = `.hk-list{display:flex;flex-direction:column;gap:4px;margin:3px 0 6px}
  .hk-big{display:flex;align-items:center;gap:7px;text-align:left;padding:4px 7px;background:#2e2412;color:#f6e8c0;border:1px solid #8a6a28;border-radius:4px;cursor:pointer;font-size:12px;line-height:1.25}
  .hk-big img{width:28px;height:28px;image-rendering:pixelated;flex:none}
  .hk-big span{display:flex;flex-direction:column;min-width:0}.hk-big small{opacity:.75;font-size:10px}
  .hk-big:disabled{opacity:.5;cursor:default}.hk-big.on,.hk-ab.on{border-color:#f6d458;box-shadow:0 0 6px rgba(246,212,88,.5)}
  .hc-abm{display:flex;gap:4px;margin:3px 0 1px}
  #hero-card .hc-abm .hk-ab{flex:1;display:flex;flex-direction:row;align-items:center;gap:4px;min-height:24px;padding:1px 5px;font-size:10px;white-space:nowrap;overflow:hidden}
  .hk-ab img{width:18px;height:18px;image-rendering:pixelated;flex:none}`;
  document.head.appendChild(st);
}
