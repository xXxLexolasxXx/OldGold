'use strict';
// Дракончики-питомцы (как в покемонах): поймать трудно, зато ручной дракончик растёт и помогает.
//  • Дикий дракончик (F.dr в fairy1.js) осторожен: бегущего или дерущегося героя замечает издалека и улетает.
//    Если герой подошёл спокойно и встал рядом, дракончик заговорит (первый — Зазулий Третий, он потерялся).
//    Приручить можно только угощением со склада: шанс зависит от приманки (у каждого вида свои вкусы), доверия
//    (поговорить), спокойствия героя, его здоровья, класса (друид и лучник-следопыт лучше) и числа попыток.
//    Три неудачи или испуг — улетает надолго. Шанс игрок видит смайликом, а не процентами.
//  • Виды: лесной, огненный, ледяной, болотный — свой цвет, свой характер и свои умения (растут с уровнем):
//    огонь/иней по врагам, свет ночью, разведка (метки врагов), перенос золота, согрев зимой.
//  • Уход: сытость, настроение, силы, болезнь (лечит лазарет), привязанность. Голодный или обиженный убегает
//    на время (насовсем не умирает). Один питомец, больше мест — с гильдией и уровнем героя.
//  • Данные — Game.fairy.dp (сохранение в поле fy.dp, зеркало коопа fy.dp). В коопе всё считает сервер,
//    питомец принадлежит игроку (ключ — ник героя, в одиночке — '').
// Числа подобраны так, чтобы питомец помогал, но не заменял героя: урон — только при шансе ≤ 55% раз в 4+ с.

const DP_SP = {
  forest: { name: 'Лесной', ic: '🌿', hue: null, likes: ['bread', 'croissant', 'hops'], ok: ['gold', 'wheat'], skills: [['carry', 1], ['scout', 3], ['light', 5]], spark: ['#a8f070', '#e8ffb0'] },
  fire:   { name: 'Огненный', ic: '🔥', hue: 8, sat: 1.15, lit: 1, likes: ['sausage', 'steak', 'chickenleg'], ok: ['goldore', 'chicken'], skills: [['flame', 1], ['warm', 3], ['light', 5]], spark: ['#ffcc50', '#ff6a30'] },
  ice:    { name: 'Ледяной', ic: '❄️', hue: 198, sat: 0.8, lit: 1.18, likes: ['fish', 'pearl'], ok: ['beer', 'bread'], skills: [['frost', 1], ['scout', 3], ['carry', 5]], spark: ['#e0f8ff', '#9ad4ff'] },
  swamp:  { name: 'Болотный', ic: '🍄', hue: 282, sat: 0.55, lit: 0.85, likes: ['darkbeer', 'fish', 'hops'], ok: ['sausage', 'magicstone'], skills: [['light', 1], ['carry', 3], ['scout', 5]], spark: ['#c8ff80', '#80e0a0'] },
};
const DP_SKILL = {
  flame: { name: 'Огонь', ic: '🔥', d: 'плюётся огнём во врагов рядом с героем' },
  frost: { name: 'Иней', ic: '❄️', d: 'морозит врагов: слабее огня, зато не промахивается по скелетам' },
  light: { name: 'Свет', ic: '💡', d: 'светит ночью, как фонарь' },
  scout: { name: 'Разведка', ic: '👁', d: 'замечает врагов далеко и метит их' },
  carry: { name: 'Носильщик', ic: '💰', d: 'приносит герою золото' },
  warm:  { name: 'Согрев', ic: '♨️', d: 'зимой греет гномов рядом' },
};
const DP_TRAIT = {
  brave:  { name: 'смелый', chance: 0, atk: 0.06 },
  shy:    { name: 'пугливый', chance: -0.08, atk: 0 },
  greedy: { name: 'жадный', chance: 0, atk: 0, gold: 1 },
  lazy:   { name: 'ленивый', chance: 0.05, atk: -0.03 },
};
// приманки в порядке предпочтения, если игрок не выбрал
const DP_BAITS = ['sausage', 'steak', 'fish', 'goldore', 'bread', 'croissant', 'darkbeer', 'beer', 'hops', 'pearl', 'gold', 'chicken', 'wheat', 'magicstone'];
const DP_LV_MAX = 8;
const DP_TRIES = 3;
const DP_NAMES = { forest: ['Мшанка', 'Листопад', 'Желудь'], fire: ['Уголёк', 'Чих-Пых', 'Искра'], ice: ['Льдинка', 'Сосулий', 'Пломбир'], swamp: ['Булька', 'Тинник', 'Квакса'] };

const dpXpFor = lv => 10 * lv * lv;                 // опыт до следующего уровня
const dpClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dpKeyOf = u => (u && (u.owner || (u.hero && u.hero.owner))) || '';

function dpState() {
  const F = fyState();
  if (!F.dp) F.dp = { pets: [], next: 1, caught: 0, lost: 0, tries: 0, fails: 0, met: 0, names: 0 };
  return F.dp;
}
function dpHeroOf(key) {
  for (const u of Game.units) if (u.type === 'hero' && !u.dead && u.hero && dpKeyOf(u) === key) return u;
  return null;
}
const dpPetsOf = key => (Game.fairy && Game.fairy.dp ? Game.fairy.dp.pets.filter(p => p.owner === key) : []);
const dpActive = key => dpPetsOf(key).find(p => p.act && p.st !== 'away') || null;

// Сколько питомцев может держать герой: один; +1 за готовую гильдию, +1 на 8-м уровне героя
function dpSlots(hu) {
  let n = 1;
  if (Game.buildings.some(b => b.state === 'done' && !b.removed && b.def && b.def.guild)) n++;
  if (hu && hu.hero && hu.hero.level >= 8) n++;
  return n;
}

// ---------- Шанс поимки (чистая функция: её проверяет тест) ----------
// inp: { sp, trait, bait, trust (0..3 — сколько раз поговорили), tries (уже неудачных), sneak, foes, hp (0..1), cls, level, fear (0..1) }
function dpChance(inp) {
  const S = DP_SP[inp.sp] || DP_SP.forest, T = DP_TRAIT[inp.trait] || {};
  if (inp.foes) return 0;                          // при врагах — никак
  let p = 0.08;
  if (inp.bait) p += S.likes.includes(inp.bait) ? 0.3 : S.ok.includes(inp.bait) ? 0.16 : 0.05;
  else return 0;                                   // без угощения не подойдёт
  if (inp.trait === 'greedy' && (inp.bait === 'gold' || inp.bait === 'goldore')) p += 0.1;
  p += Math.min(3, inp.trust || 0) * 0.06;
  p += T.chance || 0;
  if (inp.cls === 'druid') p += 0.15;
  else if (inp.cls === 'archer' || inp.cls === 'monk') p += 0.08;     // следопыт — лучник
  else if (inp.cls === 'bard') p += 0.05;
  else if (inp.cls === 'barbarian') p -= 0.05;
  const hp = inp.hp == null ? 1 : inp.hp;
  p += hp < 0.4 ? -0.1 : (hp - 0.4) * 0.08;
  p += Math.min(15, inp.level || 1) * 0.008;
  if (!inp.sneak) p -= 0.2;
  p -= (inp.tries || 0) * 0.05;
  p -= (inp.fear || 0) * 0.15;
  return dpClamp(p, 0.03, 0.8);
}
// подсказка новичку: смайлик вместо процентов
function dpHint(ch) { return ch <= 0.001 ? '🚫' : ch < 0.2 ? '😰' : ch < 0.38 ? '😐' : ch < 0.55 ? '🙂' : '😍'; }
function dpHintText(ch) { return ch <= 0.001 ? 'не подойдёт' : ch < 0.2 ? 'вряд ли' : ch < 0.38 ? 'может быть' : ch < 0.55 ? 'неплохо' : 'очень хочет'; }

function dpHave(g) { return typeof dilHave === 'function' ? dilHave(g) : 0; }
function dpTake(g, n) { return typeof dilTake === 'function' ? dilTake(g, n) : 0; }
function dpBestBait(sp) {
  const S = DP_SP[sp] || DP_SP.forest;
  for (const g of [...S.likes, ...S.ok, ...DP_BAITS]) if (GOODS[g] && dpHave(g) > 0) return g;
  return null;
}
// приманки, которые есть на складе: сперва любимые
function dpBaitList(sp) {
  const S = DP_SP[sp] || DP_SP.forest, out = [];
  for (const g of [...S.likes, ...S.ok, ...DP_BAITS]) if (GOODS[g] && !out.includes(g) && dpHave(g) > 0) out.push(g);
  return out.slice(0, 4);
}

// ---------- Дикий дракончик: вид, характер, имя ----------
function dpWildInit(d) {
  if (d.sp) return;
  const sps = Object.keys(DP_SP);
  d.sp = sps[((d.nx * 7 + d.ny * 13) >>> 0) % sps.length];
  d.trait = Object.keys(DP_TRAIT)[((d.nx * 3 + d.ny * 5) >>> 0) % 4];
  const D = dpState();
  if (!d.name) {
    if (!D.names) d.name = 'Зазулий Третий';
    else { const L = DP_NAMES[d.sp]; d.name = L[D.names % L.length]; }
  }
  d.fear = d.fear || 0;
}
function dpSneaky(hu) {
  if (!hu) return false;
  if (hu.dashUntil > Game.time) return false;
  return (hu.dpSpd || 0) < 1.0;
}
function dpFoes(x, y, r) { return typeof foesNear === 'function' ? foesNear(x, y, r).length : 0; }

// Зовётся из dragonTick, пока дикий дракончик сидит у добычи (st 'land'). true — дракончик занят разговором/испугом.
function dpWildLand(d, dt) {
  if (d.stage) return false;           // взрослый дракон с героем не разговаривает
  dpWildInit(d);
  let best = null, bd = 99;
  for (const u of Game.units) {
    if (u.type !== 'hero' || u.dead || u.inside) continue;
    const dd = Math.hypot(u.x - d.x, u.y - d.y);
    if (dd < bd) { bd = dd; best = u; }
  }
  const T = d.talk;
  if (T) {
    const hu = Game.units.find(u => u.id === T.hid && !u.dead && !u.inside);
    T.t += dt;
    if (!hu || Math.hypot(hu.x - d.x, hu.y - d.y) > 7 || T.t > 60) { dpEndTalk(d, hu ? 'Пока-пока…' : null); return false; }
    if (!dpSneaky(hu) && Math.hypot(hu.x - d.x, hu.y - d.y) < 3.5 && hu.dashUntil > Game.time) { dpScare(d, 'Ой! Не беги на меня!'); return true; }
    if (dpFoes(d.x, d.y, 8)) { dpScare(d, 'Враги! Я прячусь!'); return true; }
    return true;
  }
  if (!best) return false;
  const loud = !dpSneaky(best) || dpFoes(best.x, best.y, 6);
  if (loud && bd < (best.dashUntil > Game.time ? 10 : 6)) { dpScare(d, 'Хр-р! Слишком шумно!'); return true; }
  if (!loud && bd < 6) {
    best.dpStill = (best.dpStill || 0) + dt;
    if (best.dpStill > 1.2 && !d.noTalk) {      // герой спокойно стоит рядом — дракончик заговорит
      const D = dpState();
      d.talk = { hid: best.id, key: dpKeyOf(best), t: 0, trust: 0, tries: 0, line: D.met ? 'again' : 'first', seq: (D.met || 0) + 1, last: '' };
      D.met = (D.met || 0) + 1; fstat('dpMet');
      floater(d.x, d.y - 1.8, '?', '#ffe8a0');
      logEvent('animal', `${d.name} заметил героя и не улетел`, d.x, d.y);
      return true;
    }
  }
  return false;
}
function dpEndTalk(d, say) {
  if (say) floater(d.x, d.y - 1.6, say, '#e8f0ff');
  d.talk = null; d.noTalk = true;
}
function dpScare(d, say) {
  dpWildInit(d);
  floater(d.x, d.y - 1.6, say, '#ffb080'); fstat('dpScare');
  if (d.loot) { dropPile(Math.floor(d.x), Math.floor(d.y), 'gold', d.loot); d.loot = 0; }
  d.fear = Math.min(1, (d.fear || 0) + 0.3);
  d.talk = null; d.st = 'back';
}

// Действие героя в разговоре с диким дракончиком: 'talk' | 'bait' (g) | 'leave'
function dpWildAct(hu, a, g) {
  const F = Game.fairy, d = F && F.dr;
  if (!d || !d.talk || !hu || d.talk.hid !== hu.id || d.tamed) return { ok: false };
  const T = d.talk, D = dpState();
  T.t = 0;
  if (a === 'leave') { dpEndTalk(d, 'Ну… я тут посижу ещё.'); return { ok: true }; }
  if (a === 'talk') {
    T.trust = Math.min(3, T.trust + 1); d.fear = Math.max(0, (d.fear || 0) - 0.15);
    T.last = ['talk1', 'talk2', 'talk3'][T.trust - 1];
    floater(d.x, d.y - 1.6, '…', '#e8f0ff');
    return { ok: true };
  }
  if (a !== 'bait') return { ok: false };
  if (dpPetsOf(T.key).length >= dpSlots(hu)) { T.last = 'full'; return { ok: false, full: true }; }
  const bait = g && GOODS[g] && dpHave(g) > 0 ? g : dpBestBait(d.sp);
  if (!bait) { T.last = 'nobait'; return { ok: false }; }
  dpTake(bait, 1);
  const ch = dpChance(dpInputs(d, hu, bait));
  D.tries++; fstat('dpTry');
  if (Math.random() < ch) { dpCatch(d, hu); return { ok: true, caught: true }; }
  T.tries++; D.fails++; fstat('dpFail');
  d.fear = Math.min(1, (d.fear || 0) + 0.12);
  floater(d.x, d.y - 1.6, 'Ням… но нет!', '#ffd0a0');
  if (T.tries >= DP_TRIES || Math.random() < 0.18 + (d.trait === 'shy' ? 0.1 : 0)) {
    T.last = 'fled'; dpScare(d, 'Я ещё вернусь… наверное!'); d.t = 0;
    d.away = Game.time + 220;          // в гнезде отсидится подольше
    return { ok: true, fled: true };
  }
  T.last = 'miss';
  return { ok: true };
}
function dpInputs(d, hu, bait) {
  const H = hu && hu.hero;
  return { sp: d.sp, trait: d.trait, bait, trust: d.talk ? d.talk.trust : 0, tries: d.talk ? d.talk.tries : 0, sneak: dpSneaky(hu),
    foes: dpFoes(hu.x, hu.y, 7) > 0, hp: H && H.maxhp ? H.hp / H.maxhp : 1, cls: H && H.clsKey, level: H ? H.level : 1, fear: d.fear || 0 };
}

function dpNewPet(o) {
  const D = dpState();
  return { id: D.next++, name: o.name || 'Дракончик', sp: o.sp || 'forest', tr: o.trait || 'brave', lv: o.lv || 1, xp: 0, bond: o.bond || 20,
    sat: 80, mood: 70, en: 100, st: 'with', until: 0, act: true, owner: o.owner || '', x: o.x || 0, y: o.y || 0, z: 20, face: 1, ph: 0,
    cdA: 3, cdC: 90, sick: 0, kills: 0, nights: 0, nightNo: -1, hungry: 0, born: Game.time };
}
function dpCatch(d, hu) {
  const D = dpState(), key = dpKeyOf(hu);
  for (const p of dpPetsOf(key)) p.act = false;
  const pet = dpNewPet({ name: d.name, sp: d.sp, trait: d.trait, owner: key, x: d.x, y: d.y, bond: 25 + (d.talk ? d.talk.trust * 5 : 0) });
  D.pets.push(pet); D.caught++; D.names = (D.names || 0) + 1; fstat('dpCaught');
  floater(d.x, d.y - 1.8, 'Ур-р! Теперь я твой!', '#c8ffb0');
  fxBurst(d.x * TILE, d.y * TILE - 14, 22, DP_SP[pet.sp].spark.concat(['#ffffff']), 70, 60, 1, 2, 40);
  logEvent('animal', `Герой приручил дракончика: ${pet.name} (${DP_SP[pet.sp].name.toLowerCase()})`, d.x, d.y);
  toast(`${pet.name} теперь ваш питомец! Корми его — он вырастет и научится новому (Совет → Питомцы)`);
  // в гнезде заведётся новый дикий — не скоро: дракончики редки
  if (d.loot) { dropPile(Math.floor(d.x), Math.floor(d.y), 'gold', d.loot); d.loot = 0; }
  d.talk = null; d.st = 'gone'; d.z = 0; d.t = 0; d.away = Game.time + 565 * (3 + Math.random() * 3);
  d.sp = null; d.name = null; d.trait = null; d.fear = 0; d.stage = 0; d.raids = 0;
}

// ---------- Ручные: рост, уход ----------
function dpSkills(p) { return (DP_SP[p.sp] || DP_SP.forest).skills.filter(([, lv]) => p.lv >= lv).map(([k]) => k); }
function dpHas(p, k) { return dpSkills(p).includes(k); }
function dpGain(p, xp, bond) {
  if (bond) p.bond = dpClamp(p.bond + bond, 0, 100);
  if (!xp || p.lv >= DP_LV_MAX) return;
  p.xp += xp;
  while (p.lv < DP_LV_MAX && p.xp >= dpXpFor(p.lv)) {
    p.xp -= dpXpFor(p.lv); p.lv++;
    const nk = (DP_SP[p.sp] || DP_SP.forest).skills.find(([, l]) => l === p.lv);
    floater(p.x, p.y - 1.8, `Уровень ${p.lv}!`, '#fff2a0'); fstat('dpLevel');
    logEvent('animal', `${p.name} вырос до ${p.lv}-го уровня${nk ? ' и научился: ' + DP_SKILL[nk[0]].name.toLowerCase() : ''}`, p.x, p.y);
    if (nk) toast(`${p.name} научился новому: ${DP_SKILL[nk[0]].name} — ${DP_SKILL[nk[0]].d}`);
  }
  if (p.lv >= DP_LV_MAX) p.xp = 0;
}
// сила умения: уровень и привязанность
const dpPow = p => p.lv + p.bond / 50;
// может ли сейчас помогать
const dpCan = p => p.st === 'with' && p.sat > 12 && p.mood > 15 && p.en > 10 && !p.sick;

function dpFeed(hu, id, g) {
  const p = dpPetsOf(dpKeyOf(hu)).find(q => q.id === id);
  if (!p || p.st === 'away') return { ok: false, text: 'Питомца нет рядом' };
  if (p.sat > 90) return { ok: false, text: `${p.name} сыт и отворачивается` };
  const S = DP_SP[p.sp] || DP_SP.forest;
  const food = g && dpHave(g) > 0 ? g : dpBestBait(p.sp);
  if (!food || !dpTake(food, 1)) return { ok: false, text: 'На складе нечем кормить' };
  const fav = S.likes.includes(food), ok = S.ok.includes(food);
  p.sat = Math.min(100, p.sat + (fav ? 45 : ok ? 32 : 20));
  p.mood = Math.min(100, p.mood + (fav ? 18 : 8));
  dpGain(p, fav ? 3 : 1, fav ? 5 : 2); fstat('dpFed');
  floater(p.x, p.y - 1.6, fav ? 'Ням-ням! Любимое!' : 'Ням.', '#ffe8a0');
  return { ok: true, text: `${p.name} съел: ${GOODS[food].name.toLowerCase()}` };
}
function dpSetActive(hu, id) {
  const L = dpPetsOf(dpKeyOf(hu)), p = L.find(q => q.id === id);
  if (!p || p.st === 'away') return false;
  for (const q of L) q.act = q === p;
  if (p.st === 'home') p.st = 'with';
  for (const q of L) if (q !== p && q.st === 'with') q.st = 'home';
  if (hu) { p.x = hu.x; p.y = hu.y; }
  return true;
}
function dpRelease(hu, id) {
  const D = dpState(), i = D.pets.findIndex(q => q.id === id && q.owner === dpKeyOf(hu));
  if (i < 0) return false;
  const p = D.pets[i];
  D.pets.splice(i, 1); fstat('dpReleased');
  logEvent('animal', `${p.name} отпущен на волю`, p.x, p.y);
  return true;
}
// питомец обиделся/проголодался — улетает на время (не умирает)
function dpRunAway(p, why, days) {
  p.st = 'away'; p.until = Game.time + 565 * days; p.act = p.act; p.hungry = 0;
  p.bond = Math.max(0, p.bond - 15);
  const D = dpState(); D.lost++; fstat('dpLost');
  logEvent('animal', `${p.name} улетел: ${why}. Вернётся через ${days === 1 ? 'сутки' : days + ' суток'}`, p.x, p.y);
  toast(`${p.name} улетел — ${why}. Вернётся, если подождать`);
}

function dpWinter() { return typeof isWinter === 'function' && isWinter(); }

function dpPetTick(p, dt) {
  p.ph += dt;
  const hu = dpHeroOf(p.owner);
  // нужды: сытость тает примерно за трое суток, силы — от работы
  p.sat = Math.max(0, p.sat - dt * 0.055);
  p.en = Math.min(100, p.en + dt * (p.st === 'home' ? 0.6 : 0.12));
  if (p.sat < 15) p.mood = Math.max(0, p.mood - dt * 0.03);
  else if (p.mood < 60) p.mood = Math.min(60, p.mood + dt * 0.01);
  if (p.st === 'away') {
    if (Game.time >= p.until) { p.st = p.act ? 'with' : 'home'; p.sat = Math.max(p.sat, 50); p.mood = 50; if (hu) { p.x = hu.x; p.y = hu.y; } logEvent('animal', `${p.name} вернулся домой`, p.x, p.y); toast(`${p.name} вернулся!`); }
    return;
  }
  if (p.sat <= 0) { p.hungry += dt; if (p.hungry > 150) { dpRunAway(p, 'голодно', 1); return; } } else p.hungry = 0;
  if (p.mood <= 0 && p.bond < 30) { dpRunAway(p, 'обиделся', 2); return; }
  // болезнь: от голода и холода; лечит лазарет (герой рядом с лазаретом) или время
  if (p.sick) {
    p.sick -= dt * (hu && dpNearWard(hu) ? 6 : 1);
    if (p.sick <= 0) { p.sick = 0; floater(p.x, p.y - 1.6, 'Апчхи… здоров!', '#a0ffb0'); }
  } else if ((p.sat < 10 || (dpWinter() && p.sp !== 'fire' && p.sp !== 'ice' && isNightNow())) && Math.random() < dt * 0.0007) {
    p.sick = 400; fstat('dpSick'); logEvent('animal', `${p.name} простыл — отведите героя к лазарету`, p.x, p.y);
    toast(`${p.name} заболел. Подведите героя к лазарету — вылечится быстрее`);
  }
  if (p.st === 'home' || !hu) {        // дома (или герой пал): сидит у склада
    const st = Game.buildings.find(b => b.isStore() && !b.removed);
    if (st) { fyMove(p, st.doorX + 1.5, st.doorY + 0.5, 3, dt); p.z = Math.max(0, p.z - dt * 20); }
    return;
  }
  // летает рядом с героем; ночёвка рядом — привязанность
  p.z = 20 + Math.sin(p.ph * 2) * 3;
  const tx = hu.x - 1.6 + Math.cos(p.ph * 0.8) * 0.8, ty = hu.y - 0.8 + Math.sin(p.ph * 0.8) * 0.5;
  const far = Math.hypot(tx - p.x, ty - p.y);
  if (far > 25) { p.x = hu.x; p.y = hu.y; } else fyMove(p, tx, ty, Math.max(2.2, far * 1.2), dt);
  const ni = Math.floor(Game.time / 565);
  if (isNightNow() && p.nightNo !== ni) { p.nightNo = ni; p.nights++; dpGain(p, 2, 2); }
  if (!dpCan(p)) return;
  const pow = dpPow(p), T = DP_TRAIT[p.tr] || {};
  // огонь/иней: дальний урон по врагам рядом с героем; здания не поджигает (только сам враг)
  p.cdA -= dt;
  if (p.cdA <= 0 && (dpHas(p, 'flame') || dpHas(p, 'frost'))) {
    p.cdA = 1.5;
    const f = typeof foesNear === 'function' ? foesNear(hu.x, hu.y, 6 + p.lv * 0.4)[0] : null;
    if (f) {
      p.cdA = Math.max(4, 7 - pow * 0.35);
      const fr = dpHas(p, 'flame'), o = f.o;
      let ch = (fr ? 0.2 : 0.16) + pow * 0.035 + (T.atk || 0);
      if (typeof foeToughness === 'function') ch *= fr ? foeToughness(f) : Math.max(0.6, foeToughness(f));
      ch = Math.min(0.55, ch);
      p.en = Math.max(0, p.en - 6);
      p.shot = { x: o.x, y: o.y, t: Game.time, fr };
      fxBurst(o.x * TILE, o.y * TILE - 10, 12, fr ? ['#ffcc50', '#ff8a30', '#ffe890'] : ['#e0f8ff', '#9ad4ff', '#ffffff'], 60, 40, 0.6, 1.6, -10);
      if (Math.random() < ch && typeof killFoe === 'function') {
        killFoe(f, hu); p.kills++; dpGain(p, 4, 1); fstat('dpKill');
        floater(o.x, o.y - 1.8, fr ? 'Фр-р-р!' : 'Хрусь!', fr ? '#ffa060' : '#c0e8ff');
      } else floater(o.x, o.y - 1.6, fr ? 'Пых!' : 'Дзынь!', '#ffd0a0');
    }
  }
  // носильщик: золото герою
  if (dpHas(p, 'carry')) {
    p.cdC -= dt;
    if (p.cdC <= 0) {
      p.cdC = Math.max(80, 190 - pow * 10) + Math.random() * 40;
      const n = Math.min(4, 1 + Math.floor(p.lv / 3) + (T.gold || 0));
      dropPile(Math.floor(hu.x), Math.floor(hu.y) + 1, 'gold', n); dpGain(p, 1, 0); p.en = Math.max(0, p.en - 10);
      floater(p.x, p.y - 1.4, 'Блям!', '#ffd700'); fstat('dragPetGold', n);
      logEvent('gold', `${p.name} принёс герою золото ×${n}`, p.x, p.y);
    }
  }
  // согрев: зимой гномы рядом не мёрзнут (mood.js смотрит u.petWarm)
  if (dpHas(p, 'warm') && dpWinter()) {
    const r = 3 + p.lv * 0.4;
    for (const u of Game.units) if (!u.dead && !u.inside && Math.abs(u.x - p.x) < r && Math.abs(u.y - p.y) < r) u.petWarm = Game.time + 3;
  }
  // разведка: раз в ~20 с сообщает о врагах подальше
  if (dpHas(p, 'scout')) {
    p.cdS = (p.cdS || 0) - dt;
    if (p.cdS <= 0) {
      p.cdS = 20;
      const n = typeof foesNear === 'function' ? foesNear(hu.x, hu.y, 14 + p.lv * 2).length : 0;
      p.seen = n;
      if (n && !p.seenSaid) { floater(p.x, p.y - 1.8, `Вижу врагов: ${n}!`, '#ffb0a0'); p.seenSaid = true; dpGain(p, 1, 0); }
      if (!n) p.seenSaid = false;
    }
  }
}
function dpNearWard(hu) {
  return Game.buildings.some(b => b.type === 'infirmary' && !b.removed && b.state === 'done' && Math.hypot(b.doorX - hu.x, b.doorY - hu.y) < 5);
}

function dpTick(dt, F) {
  // скорость героев (подкрадывание): сглаженное смещение за секунду
  for (const u of Game.units) {
    if (u.type !== 'hero' || u.dead) continue;
    if (u.dpX == null) { u.dpX = u.x; u.dpY = u.y; }
    const v = Math.hypot(u.x - u.dpX, u.y - u.dpY) / Math.max(dt, 1e-3);
    u.dpSpd = (u.dpSpd || 0) * 0.85 + v * 0.15; u.dpX = u.x; u.dpY = u.y;
    if (u.dpSpd > 0.4) u.dpStill = 0;
  }
  const d = F.dr;
  if (d && d.st === 'gone') {          // гнездо пустует после поимки: новый дракончик появится не скоро
    if (Game.time >= (d.away || 0)) { d.st = 'nest'; d.t = 120; d.tamed = false; d.noTalk = false; dpWildInit(d); logEvent('animal', 'В горах снова кто-то чихает огоньком — в гнезде новый дракончик', d.nx, d.ny); }
  }
  if (!F.dp) return;
  for (const p of F.dp.pets) dpPetTick(p, dt);
}

// Старые сохранения: прирученный дракон (F.dr.tamed) становится питомцем первого героя — ничего не теряется
function dpMigrate(F) {
  const d = F.dr;
  if (!d || !d.tamed) return;
  const D = dpState(), hu = Game.units.find(u => u.type === 'hero' && !u.dead);
  const pet = dpNewPet({ name: 'Зазулий Третий', sp: 'forest', trait: 'brave', owner: dpKeyOf(hu), x: d.x, y: d.y, lv: d.stage ? 4 : 1 + Math.min(2, Math.floor((d.raids || 0) / 3)), bond: 50 });
  D.pets.push(pet); D.caught++; D.names = (D.names || 0) + 1;
  d.tamed = false; d.st = 'gone'; d.away = Game.time + 565 * 3; d.stage = 0; d.raids = 0;
  logEvent('animal', `${pet.name} теперь питомец: у него есть уровень, умения и нужды (Совет → Питомцы)`, d.x, d.y);
}

// ---------- Рисование (и у клиента коопа — по зеркалу) ----------
const dpSprCache = new Map();
function dpSpr(sp, fr) {
  const base = sprBabyDragon(fr), S = DP_SP[sp];
  if (!S || S.hue == null) return base;
  const k = sp + fr;
  let cv = dpSprCache.get(k);
  if (cv) return cv;
  cv = base;
  try {
    const c2 = mkCanvas(base.width, base.height), g = c2.getContext('2d');
    g.drawImage(base, 0, 0);
    const im = g.getImageData(0, 0, base.width, base.height), a = im.data;
    for (let i = 0; i < a.length; i += 4) {
      if (!a[i + 3]) continue;
      const r = a[i] / 255, gg = a[i + 1] / 255, b = a[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, dd = mx - mn;
      if (dd < 0.08) continue;                    // контур и серое не трогаем
      let h = mx === r ? ((gg - b) / dd) % 6 : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4; h *= 60; if (h < 0) h += 360;
      if (h < 60 || h > 180) continue;            // перекрашиваем только зелёную чешую
      const s = Math.min(1, dd / (1 - Math.abs(2 * l - 1)) * S.sat), L2 = Math.min(0.95, l * S.lit);
      const C = (1 - Math.abs(2 * L2 - 1)) * s, X = C * (1 - Math.abs((S.hue / 60) % 2 - 1)), m = L2 - C / 2, sec = Math.floor(S.hue / 60) % 6;
      const rgb = [[C, X, 0], [X, C, 0], [0, C, X], [0, X, C], [X, 0, C], [C, 0, X]][sec];
      a[i] = (rgb[0] + m) * 255; a[i + 1] = (rgb[1] + m) * 255; a[i + 2] = (rgb[2] + m) * 255;
    }
    g.putImageData(im, 0, 0);
    cv = c2;
  } catch (e) { cv = base; }
  dpSprCache.set(k, cv);
  return cv;
}
// дикий дракончик своего вида (fairy1.dragonDraw)
function dpWildSpr(d, fr) { return d.sp && !d.stage ? dpSpr(d.sp, fr) : null; }

function dpDraw(list, c, F, x0, y0, x1, y1) {
  const D = F.dp;
  if (!D) return;
  for (const p of D.pets) {
    if (p.st === 'away' || !FY_SEE(p.x, p.y, x0, y0, x1, y1)) continue;
    list.push([p.y + 0.15, () => {
      const px = p.x * TILE, py = p.y * TILE + 4, air = p.z > 1, S = DP_SP[p.sp] || DP_SP.forest;
      fyShadow(c, px, py, air ? 6 : 8, air ? 0.16 : 0.3);
      const sc = 0.8 + Math.min(DP_LV_MAX, p.lv) * 0.03;           // растёт с уровнем
      if (typeof pxbBlit === 'function') pxbBlit(c, pxbBaby(p.sp, air ? 'fly' : 'idle', air ? (Math.floor(p.ph * 54) % 12) * 2 / 3 : (Math.floor(p.ph * 8) % 12) / 2), px, py - p.z, p.face || 1, p.sick ? 0.75 : 1, sc);
      else fyBlit(c, dpSpr(p.sp, air ? fyCyc8(p.ph * 36) : 1), px, py - p.z, p.face || 1, p.sick ? 0.75 : 1, sc);
      // искорки вида: угольки, снежинки, светлячки, листики
      if ((Math.floor(p.ph * 5) % 3) === 0) { c.fillStyle = S.spark[Math.floor(p.ph * 3) & 1]; c.fillRect(Math.round(px - (p.face || 1) * 10 + Math.sin(p.ph * 4) * 3), Math.round(py - p.z - 6 + Math.cos(p.ph * 3) * 4), 2, 2); }
      if (p.sick) { c.fillStyle = '#a0e0a0'; c.fillRect(Math.round(px + 6), Math.round(py - p.z - 28 - (p.ph * 8) % 6), 2, 2); }
      if (p.shot && Game.time - p.shot.t < 0.35) {     // струя огня/инея
        c.strokeStyle = p.shot.fr ? '#ffa040' : '#bfe8ff'; c.lineWidth = 2; c.beginPath();
        c.moveTo(px + (p.face || 1) * 8, py - p.z - 12); c.lineTo(p.shot.x * TILE, p.shot.y * TILE - 10); c.stroke();
      }
    }]);
  }
}
// свет ночью: радиус как у фонаря и больше с уровнем (night.js → nightLights)
function dpLights(L, x0, y0, x1, y1) {
  const F = Game.fairy, D = F && F.dp;
  if (!D || nightAmt() < 0.15) return;
  for (const p of D.pets) if (p.st === 'with' && !p.sick && dpHas(p, 'light') && p.x > x0 - 4 && p.x < x1 + 4 && p.y > y0 - 4 && p.y < y1 + 4) L.push([p.x * TILE, p.y * TILE - p.z, 50 + p.lv * 5, 0.85]);
}

// ---------- Окно разговора с диким дракончиком ----------
const DP_LINES = {
  first: name => `Ой! Ты меня видишь? Я — ${name}. Я… потерялся. Летел домой, в горы, а тут столько гномов и все кричат. Ты не кричишь. Ты хороший?`,
  again: name => `Это опять я, ${name}. Всё ещё потерянный. У вас тут вкусно пахнет…`,
  talk1: () => 'Мама говорила: не верь гномам с лопатами. У тебя лопаты нет. Это хорошо.',
  talk2: () => 'Я умею кое-что. Ну… почти умею. Если меня кормить, научусь по-настоящему!',
  talk3: () => 'Ладно, ты мне нравишься. Только угости чем-нибудь — так у драконов принято.',
  miss: () => 'Ням… Вкусно, но я ещё не решил. Дракон — это серьёзно!',
  nobait: () => 'У вас на складе ничего вкусного. Совсем ничего!',
  full: () => 'У тебя уже есть дракончик. Я ревнивый, не пойду. (Больше мест — с гильдией или на 8-м уровне героя.)',
};
const DpUI = { el: null, sig: '', t: 0 };
const dpMyKey = () => (typeof Coop !== 'undefined' && Coop.on ? Coop.nick || '' : '');
const dpEsc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
function dpMyHero() {
  if (typeof Coop !== 'undefined' && Coop.on) return Game.units.find(u => u.type === 'hero' && u.hero && u.hero.owner === Coop.nick) || null;
  return Game.hero && !Game.hero.dead ? Game.hero : null;
}
// действие игрока: в одиночке — сразу, в коопе — серверу
function dpAct(a, x, g) {
  if (typeof Coop !== 'undefined' && Coop.on) { if (typeof coopSend === 'function') coopSend({ t: 'dp', a, x, g }); return; }
  const r = dpDo(dpMyHero(), a, x, g);
  if (r && r.text) toast(r.text);
  DpUI.sig = '';
  if (typeof updateUI === 'function') updateUI(true);
}
function dpDo(hu, a, x, g) {
  if (!hu) return null;
  if (a === 'talk' || a === 'bait' || a === 'leave') return dpWildAct(hu, a, g);
  if (a === 'feed') return dpFeed(hu, +x, g);
  if (a === 'act') return { ok: dpSetActive(hu, +x) };
  if (a === 'free') return { ok: dpRelease(hu, +x) };
  return null;
}
function dpUiEl() {
  if (DpUI.el) return DpUI.el;
  const st = document.createElement('style');
  st.textContent = `#dp-talk{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:60;width:min(94vw,440px);background:#1f1710;border:2px solid #b8902c;border-radius:8px;padding:10px 12px;color:#e8dcc0;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,.5)}
  #dp-talk.hidden{display:none}#dp-talk .dp-h{display:flex;gap:10px;align-items:center}#dp-talk canvas{width:56px;height:56px;image-rendering:pixelated;background:#2a2014;border-radius:6px;flex:none}
  #dp-talk b.dp-n{color:#f6d458}#dp-talk .dp-s{opacity:.75;font-size:11px}#dp-talk .dp-q{margin:6px 0 8px;line-height:1.35}
  #dp-talk .dp-b{display:flex;flex-wrap:wrap;gap:6px}#dp-talk button{background:#3a2c18;color:#f6e8c0;border:1px solid #7a5f28;border-radius:5px;padding:5px 9px;cursor:pointer;font:inherit}
  #dp-talk button:hover{border-color:#d8b04a}#dp-talk button.dp-bait{background:#4a3a14}#dp-talk .dp-tip{margin-top:6px;font-size:11px;opacity:.7}
  .dp-pet{border:1px solid #4a3a20;border-radius:6px;padding:6px 8px;margin:4px 0}.dp-pet .dp-bars{display:flex;gap:8px;flex-wrap:wrap;font-size:11px;margin:3px 0}.dp-pet button{margin:2px 4px 0 0}`;
  document.head.appendChild(st);
  const el = document.createElement('div');
  el.id = 'dp-talk'; el.className = 'hidden';
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-dp]');
    if (!b) return;
    const [a, g] = b.dataset.dp.split(':');
    dpAct(a, 0, g || null);
  });
  DpUI.el = el;
  return el;
}
function dpUiSync() {
  if (typeof document === 'undefined' || typeof navigator === 'undefined' || navigator.userAgent === 'node' || !document.body) return;
  const now = performance.now();
  if (now - DpUI.t < 250) return;
  DpUI.t = now;
  const d = Game.fairy && Game.fairy.dr, hu = dpMyHero(), T = d && d.talk;
  const mine = T && hu && T.hid === hu.id;
  const el = dpUiEl();
  if (!mine) { if (!el.classList.contains('hidden')) el.classList.add('hidden'); DpUI.sig = ''; return; }
  const S = DP_SP[d.sp] || DP_SP.forest, baits = dpBaitList(d.sp);
  const inp = b => dpInputs(d, hu, b);
  const opts = baits.map(g => { const ch = dpChance(inp(g)); return { g, ch }; });
  const sig = [T.seq, T.trust, T.tries, T.last, opts.map(o => o.g + dpHint(o.ch)).join()].join('|');
  if (sig === DpUI.sig) return;
  DpUI.sig = sig;
  const line = (T.last && DP_LINES[T.last] ? DP_LINES[T.last](d.name) : DP_LINES[T.line](d.name));
  let h = `<div class="dp-h"><canvas id="dp-face" width="62" height="56"></canvas><div><b class="dp-n">${dpEsc(d.name)}</b><div class="dp-s">${S.ic} ${S.name} дракончик · ${(DP_TRAIT[d.trait] || {}).name || ''} · попыток: ${DP_TRIES - T.tries}</div></div></div>
    <div class="dp-q">«${dpEsc(line)}»</div><div class="dp-b">`;
  for (const o of opts) h += `<button class="dp-bait" data-dp="bait:${o.g}" title="${dpHintText(o.ch)}">${dpHint(o.ch)} Угостить: ${dpEsc(GOODS[o.g].name.toLowerCase())}</button>`;
  if (!opts.length) h += '<span class="dp-s">На складе нет угощения — нужна еда (колбаса, рыба, хлеб) или самородок</span>';
  if (T.trust < 3) h += '<button data-dp="talk">💬 Поговорить</button>';
  h += '<button data-dp="leave">Уйти</button></div><div class="dp-tip">Смайлик — как охотно дракончик возьмёт угощение. Не бегите и не деритесь рядом: спугнёте.</div>';
  el.innerHTML = h; el.classList.remove('hidden');
  try { const cv = document.getElementById('dp-face'), g = cv.getContext('2d'); g.imageSmoothingEnabled = false; if (typeof pxbBaby === 'function') { const s = pxbBaby(d.sp, 'idle', 0), k = Math.min(62 / s.width, 56 / s.height); g.drawImage(s, Math.round((62 - s.width * k) / 2), Math.round(56 - s.height * k), Math.round(s.width * k), Math.round(s.height * k)); } else { const s = dpSpr(d.sp, 1); g.drawImage(s, Math.round((62 - s.width) / 2), 56 - s.height); } } catch (e) { /* без портрета */ }
}

// строка в окне героя
function dpHeroRow() {
  const L = dpPetsOf(dpMyKey());
  if (!L.length) return '';
  const p = L.find(q => q.act) || L[0], S = DP_SP[p.sp] || DP_SP.forest;
  const st = p.st === 'away' ? 'улетел на время' : p.sick ? 'болеет' : p.sat < 15 ? 'голоден' : p.st === 'home' ? 'дома' : 'рядом';
  return `<div class="irow">Питомец: <b>${S.ic} ${dpEsc(p.name)}</b> · ур. ${p.lv} · ${st} <span class="muted small">(Совет → Питомцы)</span></div>`;
}

// ---------- Совет → Питомцы ----------
function dpCouncilHTML() {
  const key = dpMyKey(), L = dpPetsOf(key), D = Game.fairy && Game.fairy.dp, hu = dpMyHero();
  let h = '';
  if (!L.length) h += '<div class="muted small">Питомцев пока нет. Дикий дракончик днём прилетает за золотом: подойдите героем спокойно (не бегом), встаньте рядом — и он заговорит. Угостите его едой со склада.</div>';
  for (const p of L) {
    const S = DP_SP[p.sp] || DP_SP.forest, sk = dpSkills(p).map(k => `${DP_SKILL[k].ic} ${DP_SKILL[k].name}`).join(', ');
    const nx = (S.skills.find(([, l]) => l > p.lv) || [])[1];
    const st = p.st === 'away' ? `улетел, вернётся через ${Math.max(1, Math.ceil((p.until - Game.time) / 60))} мин` : p.sick ? 'болеет (лазарет поможет)' : p.st === 'home' ? 'отдыхает у склада' : p.sat < 15 ? 'голоден!' : p.en < 15 ? 'устал' : 'с героем';
    const bar = v => v > 66 ? '🟩' : v > 33 ? '🟨' : '🟥';
    h += `<div class="dp-pet"><b>${S.ic} ${dpEsc(p.name)}</b> · ${S.name.toLowerCase()}, ${(DP_TRAIT[p.tr] || {}).name || ''} · ур. ${p.lv}${p.lv < DP_LV_MAX ? ` (${Math.floor(p.xp)}/${dpXpFor(p.lv)})` : ''}
      <div class="dp-bars"><span>Сытость ${bar(p.sat)}</span><span>Настроение ${bar(p.mood)}</span><span>Силы ${bar(p.en)}</span><span>Привязанность ${'❤'.repeat(1 + Math.floor(p.bond / 25))}</span></div>
      <div class="small">Сейчас: ${st}. Умения: ${sk || '—'}${nx ? ` · новое на ${nx}-м уровне` : ''}</div>
      <button data-cn="pets:feed:${p.id}">🍖 Покормить</button>${p.act ? '' : `<button data-cn="pets:act:${p.id}">Взять с собой</button>`}<button data-cn="pets:free:${p.id}">Отпустить</button></div>`;
  }
  if (hu) h += `<div class="small muted">Мест для питомцев: ${dpSlots(hu)} (больше — с гильдией и на 8-м уровне героя).</div>`;
  if (D) h += `<div class="small muted">Поймано: ${D.caught || 0} · убегали: ${D.lost || 0} · попыток приручения: ${D.tries || 0}</div>`;
  return h;
}
function dpCouncilClick(v) {
  const [a, id] = v.split(':');
  dpAct(a, +id);
}
if (typeof councilAdd === 'function') councilAdd({ id: 'pets', order: 5, title: 'Питомцы', html: dpCouncilHTML, click: dpCouncilClick, badge: () => dpPetsOf(dpMyKey()).some(p => p.st !== 'away' && (p.sat < 15 || p.sick)) });
