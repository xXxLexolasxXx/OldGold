# Птицы и летающие животные — фактический реестр 0.11.99

Проверена только актуальная база `output/publish/oldgold-pages-20261104`. Размеры из запущенного production index сохранены в `native-roster.json`; отсутствующие функции не заглушались. Состояния ниже — контракты отрисовки, не новые состояния AI.

| Модель | Реальные пути в js/ | Размер, anchor | Родные состояния/кадры |
|---|---|---|---|
| Курица | world/creatures.js → creatureSprite / drawCreatureAt; world/animalpx.js AK_CR.chicken; render.js; inside.js | 16×15, 8/13 | покой, peck, шаг 12; горение — внешний FX |
| Курица-мстительница | world/creatures.js, animalpx.js AK_CR.henbuff; leisure.js | 22×30, 11/28 | g0…g3 рост ног, k0…k5 пинок, s стойка; собственные henBuffPose, человеческие ноги обязательны |
| Гусь | world/creatures.js, animalpx.js AK_CR.goose; render.js | 26×24, 12/21 | покой, attack, swim, шаг 12; внешние груз/снаряжение сверять отдельно |
| Утка | world/creatures.js, animalpx.js AK_CR.duck | 22×20, 11/17 | покой, шаг 12, пет-снаряжение и родное плавание/корпус |
| Ворона-воровка | world/fauna.js crowSprite / crowFlySprite / drawCrow | земля 18×13, полёт 22×15; центр ширины; земля h−1, воздух h×0.62 | s0, w0…11, f0…11, клевок; груз x+face×7,y−z+1, scale .3 |
| Стая ворон на поле | world/beasts.js beDrawFlock → crowSprite | те же canvases, native y+3/h×0.62 | land с клевком; in/circle/leave с родной последовательностью [0,1,2,1] |
| Крышная сова | world/leisure.js owlSprite/drawOwls; fantasy-published-owls.js; world/grab.js drawOwlGrab | насест 16×20,8/19; полёт 34×20,17/11 | насест look −1/0/+1, blink; полёт 12; захват 9 поз+4 carry; добыча и когти отдельно |
| Аист | world/beasts.js beDrawStork, beFlySprite; world/animalpx.js storkS/N, akBirdFly | стоит 16×19, гнездо 16×13; полёт 30×20; native beDraw/beFly registration | nest/stand, полёт 12, рыба, кормление и птенцы отдельными слоями |
| Цапля | world/beasts.js beDrawHeron; world/animalpx.js heronS/K, akBirdFly | стоит/удар 12×19; полёт 30×20 | стоит, strike, fly/leave 12; рыба/всплеск с native anchors |
| Дятел | world/fauna2.js drawPecker → f2draw/f2sprite; animalpx.js | 6×11; tree центр+face×4; y−3, lift8, без тени | pkA/pkB, 2 кадра при ph×7; gone не рисуется |
| Пичуги | world/wildlife.js k=bird, wlFrame/wlSprite/wlDraw; animalpx.js | 7×5, wlBlit центр ширины/низ h−1; смещения каждой птицы в стае | покой 6 с клевком, шаг12, react4, полёт12; зимняя палитра birdW |
| Фазан | world/wildlife.js k=pheasant, wlFrame/wlSprite/wlDraw; animalpx.js | 16×10, wlBlit центр/низ h−1 | покой6, шаг/бег12, react4 |
| Чайка | world/seafauna.js slDraw → seaBlit; seaart.js SEA_ART.gull; pxbeasts.js | исходный 22×16,11/14; fine-art pw/ph/pax/pay уточняются runtime перед подключением | fly/idle/atk/die; после SEA_12 нормализации по12; груз и нырок снаружи |
| Баклан | world/seafauna.js k=corm; seaart.js; pxbeasts.js | исходный 22×18,11/16; fine-art bounds уточняются runtime | idle/fly/dive; SEA_12 по12; поза сушки и рыба |
| Ворон-разведчик | world/foeart.js foeDrawRaven → foeBlit; foepx.js foePxFrame/fpxRaven | FPX_BOX 32×28,15/15,scale1; внешний hover y−18 | i0…NA_N−1; родное положение относительно enemy renderer |
| Золотой гусь | world/fairy1.js goldGooseDraw → sprGoose/fyBlit | 20×18, fyBlit center-bottom; scale .9 | покой0, ходьба fyCyc6; внешняя золотая искра |
| Летучие мыши | world/nechist.js drawBats; nechistart.js nxBatFrame; world/grab.js drawBatShape/drawBatGrab | полёт18×14,9/8; захват собственные S/w/up/tal/k | 9 ступеней flap, 9 поз захвата+4 carry; жертва и drawGrip отдельными слоями |

Дополнительно обнаружен декоративный loading.js drawBat: это оформление загрузки, а не живой реестр существ. Мотыльки k=moth и бабочки — насекомые, в этот птичий пакет не включены. Драконы/грифоны не затронуты.

## Статус

Это точный начальный roster, а не заявление о готовности всех наборов. `owl-atlas-source.png` — первая генерация, отклонена для runtime: задний ¾ с глазом и только 6 flight poses. `owl-directional.png` — техническая проверка authored x2 renderer, художественная приёмка не заявлена. Production index не изменён.
