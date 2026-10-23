'use strict';
// Кампания, акт 5 = сценарий «Тишина дороже золота» (СЮЖЕТ.md, goal.js) с наследием кампании (КАМПАНИЯ.md §6):
// новая карта Долины по обычному генератору, главы 1–6 до Чёрного шпиля. В мир переходят: дошедшие гномы
// (сверх обычного старта — до 6), припасы обоза и дар Кремнёвки, кузнец Васька с железом и парой мечей,
// торговый союз с Кремнёвкой (купцы дешевле — флаг для trade.js). Сам режим — обычный сценарий: Game.camp не создаётся.
// В дилемме шпиона (traitor.js, malgor_spy) у прошедших кампанию Грум вспоминает Подгорье.

function campLegacyApply() {
  const L = campProg().legacy || {}, a4 = L.a4 || {}, a3 = L.a3 || {}, a2 = L.a2 || {};
  const store = Game.buildings.find(b => b.type === 'storehouse' && !b.removed);
  if (!store) return null;
  const extra = Math.max(0, Math.min(6, (a4.arrived || 0) - 16)), kinds = ['serf', 'farmer', 'builder', 'baker', 'woodcutter', 'serf'];
  for (let k = 0; k < extra; k++) { const s = randomFreeNear(store.doorX, store.doorY + 3, 1, 8); if (s) spawnUnit(kinds[k], s[0], s[1]); }
  const gift = a3.gift || {};
  store.stock.bread = (store.stock.bread || 0) + 10 + (gift.bread || 0);
  store.stock.stone = (store.stock.stone || 0) + (gift.stone || 0);
  store.stock.gold = (store.stock.gold || 0) + 10;
  if (a2.vaska) {
    const s = randomFreeNear(store.doorX + 2, store.doorY + 3, 1, 6);
    if (s) { const u = spawnUnit('smelter', s[0], s[1]); if (u) u.cname = 'Васька'; }
    store.stock.iron = (store.stock.iron || 0) + 6; store.stock.sword = (store.stock.sword || 0) + 2;
  }
  Game.campLeg = { from: 1, extra, vaska: !!a2.vaska, trade: !!gift.trade, hero: campProg().hero || null };
  return Game.campLeg;
}

CAMP_ACTS[5] = {
  id: 5, name: 'Тишина дороже золота', scenario: true, goalMode: 'scenario', steps: [],
  // запуск: новая карта Долины, сценарий, наследие; имя героя — то же, что в кампании
  start() {
    const look = campProg().hero || campHeroLook(campHero());
    const seed = (Math.random() * 1e9) | 0;
    setupStart(seed, { biome: 'meadow', size: 'large' });
    if (campHasUI() && typeof buildTerrain === 'function') { buildTerrain(seed); if (typeof updateMinimapBase === 'function') updateMinimapBase(); }
    if (typeof goalNew === 'function') goalNew('scenario');
    campLegacyApply();
    campHeroLookApply(campHero(), look);
    if (Game.campLeg && look) Game.campLeg.hero = look;
    const p = campProg(); p.last = 5; campProgSave(p);
    if (typeof track === 'function') track('camp-start-5', 'Кампания: сценарий с наследием');
    return true;
  },
};

// флаг наследия живёт в сохранении мира
{
  const _ser = serializeGame;
  serializeGame = function () { const s = _ser(); if (Game.campLeg) s.cleg = Game.campLeg; return s; };
  const _ap = applySave;
  applySave = function (s) { _ap(s); Game.campLeg = s && s.cleg || null; };
  const _rs = resetGameState;
  resetGameState = function () { _rs(); Game.campLeg = null; };
}

// дилемма шпиона: прошедшие кампанию помнят, кто и когда пришёл в Подгорье
if (typeof dilOpen === 'function') {
  const _do = dilOpen;
  dilOpen = function (e) {
    const done = (campProg().done || {})[1];
    if (e && e.id === 'malgor_spy' && done && e.d.indexOf('Подгорье') < 0) {
      // склейка — новая строка для перевода: кладём в словарь её английскую версию из двух известных половин
      const orig = e.d, add = 'Грум хмурится: «Ты пришёл к нам в Подгорье наутро после взрыва, Пим. С готовой летописью праздника. Тебя там не было.»';
      e.d = orig + ' ' + add;
      if (typeof I18N !== 'undefined' && I18N.tr) { const en = I18N.tr(orig), ea = I18N.tr(add); if (en !== orig && ea !== add) I18N.add('en', { [e.d]: en + ' ' + ea }); }
    }
    return _do(e);
  };
}
