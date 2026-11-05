# Шесть fairy2 существ: полный directional-проход

Графика принята ведущей. Код зафиксирован после исправления presentation-target для стационарных духов и финальной проверки production index. Публикацию выполняет ведущая; этот чат не менял индекс и игровые версии.

Источник: `output/publish/oldgold-pages-20261104/js/fantasy-published-haunts.js`.
SHA-256: `39cd99385ebcb6a12a730da9722ebf6f38124f5406706e86260b9e5faf9fcadc`.
API: `FantasyPublishedHaunts.version === 4`.

Полудница, банши, враждебный лесной дух fairy2, кикимора, водяной fairy2 и русалка имеют отдельно нарисованные анфас, передний 3/4, профиль, задний 3/4 и спину. Левые парные направления зеркальны правым: итог восемь направлений. Это реальные новые проекции тела/головы/одежды, а не сжатие анфаса. На спине нет фронтальных лиц; тело скрывает дальние части, ближние руки рисуются поверх. Сохранены принятые полные тела и material pixel-art pipeline.

Все шесть обязательных PNG и их SHA перечислены в `DIRECTIONAL_READY.json`: прежние `haunt-bodies-v3.png`, `haunt-busts-v2.png` и новые `haunt-bodies-v4-SE.png`, `haunt-bodies-v4-E.png`, `haunt-bodies-v4-NE.png`, `haunt-bodies-v4-N.png` в `assets/fantasy/` canonical clone. Новые четыре исходника созданы встроенным image_gen с прозрачным фоном; точные запросы — `imagegen-prompts.txt`, mapping исходных файлов — `install-assets.cjs`. Project assets не зависят от внешней generated_images папки.

## API и интеграция

```js
const A = FantasyPublishedHaunts;
await A.ready;
if (A.assets.errors.length) throw new Error(A.assets.errors.join(', '));

// Native lv, native quantized phase, native walk phase or -1.
const sprite = A.frame('kik', [1, 1/3, -1], 'SE');
const death = A.death('kik', 5, 'NE');
// sprite.fzO === [ox,oy,worldWidth,worldHeight], fzPx true, canvas world*2.

// Preview-only orientation; never stored in the actor/save.
A.setHeading(privatePreviewActor, 'N');
A.setHeading(privatePreviewActor, null);
```

В игре обычный `fairy2DrawList` регистрирует только шесть нужных семейств в private WeakMap. `fzLive` устанавливает контекст вида по существующим движениям/цели/waypoint. Стационарная русалка поворачивается к уже затронутому `_lure` слушателю, лесной дух — к уже затронутому `fzWander` дровосеку или существующему спокойному `gift`. Это чтение фактов native simulation, без назначения AI-целей и изменения NPC. Native post-render face mirror компенсируется до отрисовки, кисти/точки жертвы/FX сохраняются при обоих знаках face и всех ракурсах. Функции симуляции не заменены.

Внутри canvas x2, шаг0,5 мира, binary normal alpha и дискретные material palettes. Для native гибели собирается исходная3x маска, затем применяются прежние карты распада/сроки. Покой, действия, гибель — все родные12фаз; шаг у les/kik, где он существует. Переходы покрывают родные¼ lv и⅙ lv банши. Новых передвижений или состояний ради демонстрации не придумано.

Кэш ограничен: material512/24MiB и display256/8MiB; original native FZ cache сохраняет свой отдельный лимит. Нормализованный ключ включает вид существа, canonical ракурс, компенсацию native mirror, native позу/фазу/шаг и noout. Raw time ключей нет. Подробности/измерения в manifest.

## Проверки

- `node output/fantasy/haunts/directions/verify-v4.cjs --production` — **EXIT0**, настоящий canonical index, без замены response и без addScriptTag. Desktop1440×1000 и mobile390×844: по7488 проверок, восемь уникальных видов для всех6, разные циклы,12уникальных фаз смерти, exact dimensions/fzO, normal alpha binary, без top/bottom clipping.48 native fzLive/post-mirror compositions совпадают с API на каждом viewport; hand anchors также проверены при обоих native face. Повторный кадр использует готовый объект;1000invalid view aliases не создают miss. Save/tick/wolf/wisps неизменны.
- `node output/fantasy/haunts/directions/verify-production-v4.cjs` — **EXIT0**, один реальный canonical module, все ассеты готовы.56/56 heading cases на каждом viewport: существующие цели/waypoints, listener/cutter и8 calm gift направлений. Сохраняемые данные не мутируют.
- Реальные кадры `production-{1440,390}-{0..7}.png` получены из native depth list с private staged actors; это честная QA-постановка, не заявление о естественно возникшей встрече. Автообучение отключено только preference в чистом тестовом контексте, игра остаётся на паузе, мобильная камера вмещает все6.

`checks.json` и `production-checks.json` — полные результаты. Размер/лимиты соблюдены; runtime errors/missing static assets/assetErrors пусты. Контрольные суммы frozen source и всех необходимых файлов — в `DIRECTIONAL_READY.json`.

## Просмотр

- `five-views-preview.png` — шесть существ × пять отдельных проекций, русские подписи. Просмотрены также профиль и спина в фазах действия/гибели; наслоения проверены.
- `all-cycles-eight-directions.gif` и `.mp4` — все6, восемь направлений, для каждого12фаз четырёх колонок: покой, шаг/колыхание, действие, гибель. Увеличено только для просмотра; размер в игре сохранён.
- `animation-frames/000.png…095.png` — исходные контрольные листы анимации.

Остальные non-dwarf/animal семейства находятся у своих владельцев. Этот результат завершает именно перечисленные шесть; общий мировой scope не объявляется готовым. Новые правила всех графических задач записаны по прямому запросу пользователя в корневых `AGENTS.md` и `GRAPHICS_RULES.md`; животные явно включены, правка более узких дорог с восемью спокойными вариантами также зафиксирована и передана ведущей/владельцу поверхностей.

`build-v4.cjs` — исторический миграционный scaffold до финальной полировки. Авторитетный source — frozen canonical `.js`, не перегенерировать его старым scaffold. Принятый v3 baseline сохранён как `approved-haunts-v3.js`.


## Закрытие самоаудита — финальная версия

Исправлены два найденных дефекта: большой палец водяного при компенсации native mirror и хвостовой плавник русалки в крайних фазах SE/SW касались боковой границы. Ограничены только вылет пальца и боковой сдвиг строки хвоста; опоры, wrist/FX anchors, масштаб, механика и тайминги не менялись. `all-borders-checks.json`: 1152 кадра, оба native face, все восемь направлений, все четыре границы — bad пуст.

`native-worldscale-1to1.png` и `worldscale-and-enlarged.png`: cold-native, принятый v3 и пять текущих видов рядом при одном мировом масштабе и одинаковой опоре. `worldscale-checks.json` содержит 42 измерения visible bbox; силуэты нового дизайна не объявляются идентичными старым. Исходный native имеет анфас/зеркало, отдельного native E нет — это явно указано на листе. Новые виды используют общую шкалу, без индивидуального растягивания под reserved canvas.

Открытых известных дефектов этих шести семейств после повторного QA нет. Общие дороги, животные и другие семейства не входят в этот handoff. UI-портреты остаются динамическими от текущих body providers; окончательный общий лист надо переснять после обновления соседних наборов. Никаких новых художественных проходов сегодня не начато. Работа в общей publicationclone: параллельный git add/commit не выполнялся; snapshot и публикация централизованно у ведущей.
