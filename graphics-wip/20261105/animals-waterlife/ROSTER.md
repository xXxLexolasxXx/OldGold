# Реестр водного набора OldGold

Источник: текущая опубликованная сборка oldgold-pages-20261104; не старый runtime в корне feod.

| Вид | Native renderer / art | Desktop W×H; ax,ay | Mobile W×H; ax,ay | Родные позы → новые кадры |
|---|---|---|---|---|
| Килька (sprat) | js/world/seaart.js | 7×4; 3,3 | 7×4; 3,3 | swim: 4→4 |
| Лосось (salmon) | js/world/seaart.js | 16×14; 8,12 | 16×14; 8,12 | swim: 8→12, jump: 6→12 |
| Краб (crab) | js/world/seaart.js | 17×14; 8,12 | 17×14; 8,12 | idle: 6→12, walk: 8→12, atk: 9→12, die: 6→12, hide: 6→12 |
| Морская звезда (star) | js/world/seaart.js | 9×8; 4,7 | 9×8; 4,7 | idle: 6→6 |
| Морской ёж (urchin) | js/world/seaart.js | 9×7; 4,6 | 9×7; 4,6 | idle: 6→6 |
| Медуза (jelly) | js/world/seaart.js | 13×16; 6,12 | 13×16; 6,12 | swim: 8→12, atk: 9→12, die: 6→12 |
| Черепаха (turtle) | js/world/seaart.js | 20×13; 10,11 | 20×13; 10,11 | idle: 6→12, swim: 8→12, walk: 8→12 |
| Черепашонок (hatch) | js/world/seaart.js | 7×5; 3,4 | 7×5; 3,4 | walk: 6→6 |
| Дельфин (dolphin) | js/world/seaart.js | 26×22; 13,18 | 26×22; 13,18 | swim: 8→12, jump: 9→12 |
| Кит (whale) | js/world/seaart.js | 52×26; 26,22 | 52×26; 26,22 | swim: 8→12, spout: 6→12 |
| Осьминог (octo) | js/world/seaart.js | 22×20; 11,16 | 22×20; 11,16 | idle: 6→12, swim: 8→12, atk: 9→12, die: 6→12 |
| Морской змей (serpent) | js/world/pxbeasts.js | 124×72; 60,50 | 44×26; 22,20 | swim: 8→12, atk: 9→12, die: 6→12 |
| Щупальце кракена (tent) | js/world/pxbeasts.js | 64×100; 24,92 | 18×46; 9,44 | idle: 6→12, atk: 9→12, die: 9→12, rise: 6→12 |
| Голова кракена (kraeye) | js/world/pxbeasts.js | 68×40; 34,34 | 26×16; 13,14 | idle: 6→12 |
| Раковина (shell) | js/world/seaart.js | 7×5; 3,4 | 7×5; 3,4 | idle: 2→2 |
| Морская русалка (mermaid) | js/world/seafolk.js | 16×20; 8,17 | 16×20; 8,17 | sit: 6→12, dive: 6→12 |
| Озёрный водяной (vodyanoy) | js/world/seafolk.js | 16×18; 8,15 | 16×18; 8,15 | idle: 6→12, dive: 6→12 |

shoal — групповой renderer, собственной модели нет: он размещает sprat с прежними n/seed/scat/ph, бликами и anchors.

Морские 12-кадровые циклы сохранили native нормализацию. У friendly mermaid/vodyanoy native art содержит 6 поз; новый renderer делит ту же фазу на 12 шагов, не меняя AI, lifespan, таймеры или длительность нырка. У sprite0/1 раковины сохранены две формы; жемчужина остаётся родной.

Дополнительно: inland fish — beasts.js/beDrawFish, 10×5 исходный body bitmap, body origin (-5,-2), родная дуга 0.85 с и блики сохранены. Fairy1 gold/red/blue — 28×16, fyBlit scale .8, swim/caught, 12 frames. Fairy1 amber/pink/teal — 34×14, swim scale .75, jump raw bitmap contract, 12 frames. Полные числовые сведения — roster.json.

Направление: native a, затем tx/ty, затем реальное изменение позиции в WeakMap, затем родной face/сохранённый transient heading. У неподвижных звезды/ежа/раковины нет выдуманного AI-направления. У friendly персонажей и щупалец в native есть только face: в игре выбираются доступные левые/правые направления; остальные ракурсы доступны renderer API для покрытия и будущего контекста ориентации. Все восемь ракурсов не объявляются восемью новыми движениями AI.

Не менялись: птицы gull/corm, fairy2 haunted русалка/водяной, суда, жемчужина, игровые механики, длительности, сохранения.
