# Завершение дня — МАЛАЯ ФАУНА

Статус на остановке: **PENDING / НЕ ВКЛЮЧАТЬ В LIVE**. Общая publication-папка, не отдельный checkout/worktree. Параллельный git add/commit не выполняла; snapshot собственных файлов последовательно делает ведущая `01a1a2b3-2a33-73b3-8aab-6f77e1d39b63`. Не выполняла reset/clean/push. Новые проходы/семейства не начинала.

## Что сохранить

Четыре проектных файла в `output/publish/oldgold-pages-20261104`:

- `js/fantasy-published-smallfauna.js`
- `assets/fantasy-smallfauna/palettes.json`
- `assets/fantasy-smallfauna/frog-atlas.json`
- `assets/fantasy-smallfauna/frog-directions.png`

Точные финальные SHA / размеры — `required-files.sha256.json` в этой папке. Весь назначенный пакет и незавершённые QA-результаты сохранены в `output/fantasy/animals-smallfauna/`. Старый runtime 0.9 не переносился. Чужие renderer-файлы, index/sw/version не меняла.

## Что готово

Девять native видов, полный body redesign, пять видов /8 headings, native selectors и reachable states. Roster — `ROSTER.md`; общая архитектура и ограничение cargo anchors — `HANDOFF.md`. Контроллеры, AI, длительности, footprint, сериализация не менялись; направление WeakMap/context. Кэш ≤768 entries /16 MiB RGBA, readiness/errors и native fallback явные.

До последнего уточнения worldscale прошли: 1704 frame/view/color сочетания на desktop + столько же на mobile viewport, 0 пустых кадров, 0 касаний края NA, 0 entity mutations; 192 вызова со слоями /грузом /FX в 8 headings. Полные native циклы: frog 7/7; snail 42/42; newt/moth 36/36 reachable. Есть native Game.step/fwThink video desktop/mobile и fail-load fallback test. `/coop-info` 404 честно записан как ограничение статического сервера, не заглушён.

## Последний небольшой шаг — worldscale

По свежим правилам нашла несоответствие: frog atlas прежде подгонял каждую колонку к reserved native width/height. Это **исправлено в коде**: теперь одна cold-native калибровка позы применяется одинаково ко всем пяти авторским видам; реальные отношения ширин/высот между ракурсами сохраняются. E-reference получен в отдельной свежей production странице до подключения модуля. Добавлены native x-center /opaque-foot offsets, включая старый −0,5 world pixel для нечётной ширины. Новый буфер имеет прозрачный запас и не является доказательством размера; мировая опорная точка drawFrog осталась прежней. Рисунки разных поз используют native pose calibration, но внутри позы нет индивидуального fitting ракурсов.

Холодный baseline и PNG: `worldscale-cold-baseline.json`, `cold-native/`. Новая проверка 1:1 рядом с увеличением и пятью видами: `worldscale-audit.json`, `worldscale-actual-and-enlarged.png` (если текущий завершаемый прогон успешен; результат отдельным файлом, а не молчаливым PASS). Калибровка находится в проектном `frog-atlas.json`. В readiness добавлена проверка схемы калибровки.

Завершаемый прогон **успешно сохранился**. Для лягушки reference E actual 1:1 совпадает с cold native: bbox x[-6,5), y[-3,4), 11×7, родная опорная точка (0,4). Общая калибровка используется всеми пятью видами одной позы; нет отдельных fit по ракурсам. У остальных видов обнаружены различия silhouette coverage: butterfly E 8×3 →3×3, worm 7×4 →7×5, newt 40×17 →42×15, lantern 37×24 →35×22; разные анатомические проекции и антиалиасинг tiny native требуют отдельной оценки, это **не считается автоматическим scale PASS**. JSON поля `opaqueMaskTop` / `lowestCoveragePixelY` — границы маски, не анатомическая голова или стопа; их нельзя выдавать за доказательство сохранения head/foot landmarks.

Точный список собственных файлов для последовательного snapshot — `commit-owned-files.txt` (пути относительно feod; runtime + отчёты/результаты, исключены только raw повторные video и animation-frames caches). Live требуется только 4 проектных файла, и текущий пакет пока НЕ live-ready.

**После этой последней правки полный 1704-проход, GIF и игровые WebM не перезапускала из-за прямого распоряжения завершить день.** Их предыдущие PASS относятся к SHA `2c20c761a1159cc7082bf2762a5437ffafd8348a78a8500a0c8072f87fff80e4` и старому atlas manifest. Старые обзорные PNG/GIF/video сохраняются как результаты предыдущего этапа, не как финальная приёмка новой worldscale-версии. `DAY_END_HANDOFF.md` имеет приоритет над ранней формулировкой «готов к интеграции» в HANDOFF.

## Что осталось / что не публиковать

- Не подключать текущую worldscale-версию в live, пока не повторены QA и не просмотрен 1:1 лист с холодным native. Особенно проверить frog head/foot уровни, все семь поз и clipping расширенного presentation-буфера.
- Проверить холодный baseline /1:1 для всей группы и сверить возможные различия реальных стоп/высоты головы newt и tiny insects, не ограничиваться canvas. В JSON сохранены действительные измерения, а не заявленное совпадение.
- Холодная и новая страницы — разные свежие миры; перед финальной оценкой tiny visibility нужно также зафиксировать одинаковые weather/day gating conditions (особенно пчелу). Текущий 1:1 лист — диагностический, не итоговая художественная приёмка. Никакие gating-функции ради картинки не заглушались.
- Пересобрать обзорные артефакты для нового SHA, чтобы они не показывали прежнюю per-view подгонку лягушки.
- Общий production index + SW без инъекции, совместно с соседними модулями, остаётся обязательной работой ведущей. Реальный телефон /performance не проверены.
- Native волокуша и верёвка улитки сохраняют старые боковые экранные anchors при новых передних/задних видах. Новые точки привязей не вводились. Червь не имеет native цели/ориентации, в игре остаётся в исходном профиле; другие виды червя — только анатомический preview.
- Художественная приёмка пользователем не объявляется состоявшейся.

Полезные QA scripts: `qa.cjs`, `animate.cjs`, `compare.cjs`, `layers-qa.cjs`, `game-qa.cjs`, `failure-qa.cjs`, `worldscale-cold.cjs`, `worldscale-audit.cjs`. Raw `animation-frames/` и `video/` — локальные QA промежуточные файлы, не required live assets. Никакие отчёты, PNG-сравнения и WebM не нужны production loader.
