'use strict';
// Перепись существ карты (для wildlife-test и СУЩЕСТВА_БАЛАНС.md): кто живёт на карте по видам и категориям.
// Нейтралы логов (Game.neutrals), звери (Game.animals), кабаны-бродяги (Game.boars), лепреконы (Game.lepr).
const CAT = {
  pixie: 'fairy', fairy: 'fairy', boar: 'boar', beBoar: 'boar',
  leshy: 'neutral', spore: 'neutral', troll: 'neutral', trollS: 'neutral', trollB: 'neutral', armad: 'neutral', gtSpear: 'neutral', gtBow: 'neutral',
  goblin: 'evil', frost: 'neutral', ftG: 'neutral', ftB: 'neutral', ftP: 'neutral', lepr: 'neutral',
  deer: 'peace', rabbit: 'peace', goat: 'peace', elk: 'peace', chicken: 'peace', goose: 'peace', duck: 'peace',
  wolf: 'evil', fox: 'evil',
};
const CENSUS_JS = `(function(){
  const o = {};
  const add = k => { o[k] = (o[k] || 0) + 1; };
  for (const N of Game.neutrals || []) if (N.st !== 'die') add(N.k);
  for (const a of Game.animals || []) if (!a.dead && !a.owner) add(a.kind);
  for (const b of Game.boars || []) add('beBoar');
  for (const l of Game.lepr || []) add('lepr');
  return JSON.stringify(o);
})()`;
function census(h) { return JSON.parse(h.run(CENSUS_JS)); }
// доли: все существа, только нейтралы логов (их видно на карте с полоской здоровья — по ним игрок и судит)
function shares(c) {
  const all = Object.values(c).reduce((s, v) => s + v, 0);
  const neuKeys = Object.keys(c).filter(k => CAT[k] === 'fairy' || CAT[k] === 'neutral' || k === 'boar' || k === 'goblin');
  const neu = neuKeys.reduce((s, k) => s + c[k], 0);
  const fairies = (c.pixie || 0) + (c.fairy || 0), boars = (c.boar || 0) + (c.beBoar || 0);
  return { all, neu, fairies, boars, fairyAll: fairies / all, boarAll: boars / all, fairyNeu: fairies / Math.max(1, neu), boarNeu: (c.boar || 0) / Math.max(1, neu) };
}
module.exports = { census, shares, CAT };
