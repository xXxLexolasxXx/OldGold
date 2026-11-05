# Маленькие животные — фактический реестр

База: `output/publish/oldgold-pages-20261104`, 0.11.99. Проверено по исходным контроллерам 5 ноября 2026.

| Существо | Native renderer / getter | Родные состояния / кадры | Размер и опора |
|---|---|---|---|
| Лягушка | `js/world/fauna.js`: drawFrog → frogFrame → frogSprite → afSprite; дополнительный рисунок `animalpx.js` afHand(/^frog:/) | sit, blink, croak, crouch, launch, air, land — 7 именованных кадров; выбор фаз hop 0.12/0.3/0.7/0.88 остаётся native | строки 11×7, 11×5, 11×6, air 12×6; центр X, низ Y; py=y*TILE+3; дуга прыжка 9 |
| Бабочка (5 цветов) | `js/world/leisure.js`: drawButterfly; updateCritters | непрерывный взмах abs(sin(ph)); native ph+=14*dt; визуальная нормализация 12 фаз | крылья до 6.6×2; тело 1×3; центр x*TILE, y*TILE−10−sin(ph*.5)*2 |
| Мотыльки у огня | `js/world/wildlife.js`: wlDraw, k=moth | ровно 4 native фазы крыла; стая 2–4; орбитальное движение каждого участника | тело 1×2, крылья до 5.8×1.5; halo 6×6; native орбиты/alpha |
| Пчела | `js/world/beasts.js`: beDrawBees | 2 native фазы крыла floor(time*25+ph)&1; target tx/ty | тело 3×2, крылья ещё 1 вверх; native 14/11 Hz визуальный дрейф |
| Светлячок | `js/world/fauna.js`: drawFireflies | native мерцание max(0,sin(ph*bl))^.6, орбита a / a*1.3; нормализованные 2 фазы крыла | светящаяся точка 1×1; halo до 7×7; высота z и native осцилляция |
| Дождевой червь | `js/world/fauna.js`: drawWorm | 7 сегментов; непрерывная волна sin(ph*5+i*.9); нормализация 12 фаз | 7×4 с тенью y+2; не перемещается, собственной цели нет |
| Болотная улитка-тяжеловоз | `js/world/frogart2.js`: drawSnail; NA_DRAW.snail → naFrame; `frogwild.js`: fwDraw → fwArt | i0…11, w0…11, h0…5 (сворачивается), v0…11; 42 доступных кадра | NA_SPEC 60×44, ax=28 ay=36 sc=1.2; fwDraw py=y*TILE+6; волокуша/верёвка/ошейник остаются native |
| Мотылёк-фонарик | те же frogart2/NA getter/controller, k=moth | i0…11, w0…11, v0…11; 36 достижимых; h0…5 поддерживаются getter, но fwTick moth не пугает | NA_SPEC 64×62, ax=30 ay=48 sc=1.2; native bob и ночной свет |
| Водяной тритон | те же frogart2/NA getter/controller, k=newt | i0…11, w0…11, v0…11; 36 достижимых; h0…5 поддерживаются getter, но испуг newt выбирает w | NA_SPEC 64×40, ax=28 ay=32 sc=1.2 |

Старый комментарий frogart2 «6/8/4/4» неверен: действующий NA_N=12, NA_HURT_N=6 и fwFrame используют 12/12/6/12. Улитка — брюхоногий моллюск, ноги не добавляются. У тритона четыре лапы, хвост и существующие красные жаберные веточки сохраняются как часть реальной native модели. У насекомых шесть ног, четыре крыла у бабочек/мотыльков, две визуально объединённые пары у пчелы; у червя нет глаз, лап и усиков.

Исключены ftG/B/P/R/K/Q/Z/ZF (гуманоиды), armad и BoarGuardian. WL moth и NA moth — отдельные существа. Других реальных frog/butterfly/bee/firefly/worm getters в актуальном renderer-path не обнаружено. Самостоятельных native hurt/death у крошечной фоновой фауны нет: не добавляем новые игровые состояния.
