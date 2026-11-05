# ПОСЛЕДНЕЕ УТОЧНЕНИЕ ОБЛАСТИ И КООРДИНАЦИИ

Животные исключены из дальнейшего редизайна. Ничего не удалять, не откатывать и не публиковать автоматически. Смешанный набор и следующий разрешённый шаг: COORDINATION_HANDOFF.md. Serpent/kraken — HOLD до классификации; friendly seafolk — только после согласования отдельного владельца/файла и независимого review. Сегодня работа остаётся остановленной. Ниже сохранён исторический отчёт, а не действующее разрешение продолжать животных.

---

# Завершение дня · водный набор · PENDING, НЕ В LIVE

По прямому распоряжению пользователя остановилась после сохранения текущего шага. Подчинённых агентов нет. Новые семейства и проходы не начинаются.

## Для ведущей 01a1a2b3-2a33-73b3-8aab-6f77e1d39b63

**Не подключать и не публиковать водный модуль сегодня.** Сохранить в общем snapshot как незавершённую работу. Единственная кандидатная runtime-версия находится в `output/publish/oldgold-pages-20261104/js/fantasy-published-waterlife.js`, но её статус releaseReady=false.

Последняя функционально проверенная версия:
- `js/fantasy-published-waterlife.js`
- SHA-256: `dcd1bfd30b008c863c86ab8ceb7d1873cc650b3d251902096bed2b3b82b7bac3`
- SHA совпадает с moduleSHA256 в qa.json. Проверки: 3360 marine/seafolk кадров/8 направлений, 1152 реальных fairy1 callbacks, 96 inland poses, 304 mobile first-frame комбинации, 192 frozen kraken callbacks, unchanged serialized/frozen state, bounded cache/reuse, интерактивный просмотр 17 marine/seafolk форм без page errors.

Это **не scale PASS и не integrated-index PASS**. Старые положительные функциональные проверки сохранены с их точным ограничением.

Незавершённая доработка:
- `output/fantasy/animals-waterlife/worldscale-wip.js`
- SHA-256: `5394f7ffa5b1f24b29831387d777aa0eecaec311b843d5405022a5a411415fee`
- Только `node --check` PASS. В production не загружать. Появились render-only прозрачные поля с компенсацией world root, общие anatomical physical-параметры, завершённый изгиб/жало щупальца, более широкие руки осьминога и native-root blits для рыб, которым исходный raw bitmap мешал показывать полный поворот. Таблица physical ещё пустая; калибровка и browser QA не выполнены. Нельзя объявлять эти изменения прошедшими тесты стабильной версии.

`pre-worldscale-waterlife.js` — сохранённый исходный проверенный snapshot. Именно из него восстановлен мой runtime-файл после остановки; это не git reset/clean и не откат чужих правок.

## Что сделано

Полные новые body meshes: sprat/shoal, salmon, crab, star, urchin, jelly, turtle/hatch, shell, dolphin, whale, octo, serpent, tent/kraeye, дружелюбные SEA_ART mermaid/vodyanoy, inland fish, fairy1 gold/red/blue/amber/pink/teal. Новая геометрия пяти самостоятельных видов и восьми проекций, все реальные native циклы. Сохранены native state/timer/AI/footprint/serialization. Ближние/дальние части сортируются по глубине; собственный LRU 768 entries/24 MiB, WeakMap headings, ready/errors. ImageGen reference краба сохранена в проекте, промпт рядом; runtime зависит только от JS.

В самопроверке исправила: видимость зрачков и клешней, две формы раковины, native полное втягивание головы черепахи, фазовый beat splash, inland jump alignment/glint, упрощённые материалы больших существ (чешуя, присоски, крючья, рога/жабры/хвост, складки/рубцы) после просмотра actual directional-листа Малгора. Это не автоматическая художественная приёмка.

## Новая worldscale-проверка: известные отклонения

`worldscale-qa.json` получен на cold native странице ДО инъекции адаптера. `worldscale-1to1.png` показывает actual 1:1 old/new рядом с одинаково увеличенной парой, с той же фазой и опорой. Числа ниже — union видимых E bbox по первому native циклу, а не длина тела отдельно от движения; финальная калибровка должна учитывать это, особенно для частично погружённых/прыгающих животных.

- Краб: old W16, new W11; опора/низ old +1, new +2.
- Осьминог: old W19, new W11; низ old +1, new +3.5.
- Щупальце: old W40, new W26; высота близка (74/76), но изгиб/жало и foam envelope различаются.
- Голова кракена: old 62.33×30.33, new 48×40; новый силуэт достигает верхней границы буфера, нужен контроль обрезки в задних видах.
- Змей: old 110.33×36.67, new 103×46.5; высота/уровень головы завышены. Есть риск обрезки при заднем повороте, который нельзя скрывать сравнением canvas.
- Tiny hatch: old 6×5, new 5×3. Sprat: old 6×2.33, new 5×3.5.
- Остальные точные размеры/уровни — worldscale-qa.json. У dolphin swim union включает native движение всплывающей части: не нормализовать новую полную модель по union вслепую; использовать cold native полную jump-позу и одинаковую фазу для physical baseline.

Следующая работа: единая для всех ракурсов физическая калибровка по cold-native E, реальные head/foot/waterline уровни, прозрачные render margins с доказанным неизменным world root, повтор всех релевантных циклов/мобильных и live world/combat/FX проверок. Не растягивать каждую проекцию независимо. Никаких новых изменений механики.

## Что НЕ включать в live

- Ни текущий runtime-кандидат, ни worldscale-wip.js — до закрытия worldscale и integrated-index QA.
- Не включать QA/preview/debug helpers и reference PNG в игровой index.
- Прежние directions/cycles/compare PNG содержат отозванную новым уточнением подпись «масштаб в игре сохранён»: это архив промежуточного арта, не доказательство scale PASS.
- Не использовать sprite/fixture PASS вместо natural spawning, настоящего боя, night jelly glow, waterline и victim/FX anchors в штатном index.

## Коммит и координация

Работа находится в общей publicationclone. Параллельный git add/commit не делала: пользователь поручил ведущей сохранять общий snapshot последовательно. Git сообщает dubious ownership при read-only rev-parse; safe.directory и глобальную конфигурацию не меняла. Commit SHA отсутствует — коммит выполняет ведущая. Никаких reset/clean/forcepush/push не выполняла. index/sw/changelog/version/native renderer-файлы и чужие наборы не меняла.

Отдельный tool-follow-up в ведущий чат ранее отклонила автоматическая проверка: она не нашла явного разрешения отправить сообщение именно в тот чат. Обхода и повторной отправки не было. Этот handoff сохранён на общем диске и доступен ведущей.

## Точные собственные файлы для snapshot

- `feod/output/publish/oldgold-pages-20261104/js/fantasy-published-waterlife.js`
- `feod/output/fantasy/animals-waterlife/compare.png`
- `feod/output/fantasy/animals-waterlife/crab-imagegen-reference.png`
- `feod/output/fantasy/animals-waterlife/crab.png`
- `feod/output/fantasy/animals-waterlife/cycles.png`
- `feod/output/fantasy/animals-waterlife/debug-preview.cjs`
- `feod/output/fantasy/animals-waterlife/directions.png`
- `feod/output/fantasy/animals-waterlife/fish.png`
- `feod/output/fantasy/animals-waterlife/HANDOFF.md`
- `feod/output/fantasy/animals-waterlife/imagegen-prompt.txt`
- `feod/output/fantasy/animals-waterlife/inspect.cjs`
- `feod/output/fantasy/animals-waterlife/kraken-qa.json`
- `feod/output/fantasy/animals-waterlife/manifest.json`
- `feod/output/fantasy/animals-waterlife/mobile-qa.json`
- `feod/output/fantasy/animals-waterlife/native-sea-sheet.png`
- `feod/output/fantasy/animals-waterlife/pre-worldscale-waterlife.js`
- `feod/output/fantasy/animals-waterlife/preview-crab.png`
- `feod/output/fantasy/animals-waterlife/preview-kraeye.png`
- `feod/output/fantasy/animals-waterlife/preview-mermaid.png`
- `feod/output/fantasy/animals-waterlife/preview-qa.json`
- `feod/output/fantasy/animals-waterlife/preview-serpent.png`
- `feod/output/fantasy/animals-waterlife/preview-tent.png`
- `feod/output/fantasy/animals-waterlife/preview.html`
- `feod/output/fantasy/animals-waterlife/qa-kraken.cjs`
- `feod/output/fantasy/animals-waterlife/qa-mobile.cjs`
- `feod/output/fantasy/animals-waterlife/qa-preview-mobile.cjs`
- `feod/output/fantasy/animals-waterlife/qa-preview.cjs`
- `feod/output/fantasy/animals-waterlife/qa-worldscale.cjs`
- `feod/output/fantasy/animals-waterlife/qa.cjs`
- `feod/output/fantasy/animals-waterlife/qa.json`
- `feod/output/fantasy/animals-waterlife/roster.json`
- `feod/output/fantasy/animals-waterlife/ROSTER.md`
- `feod/output/fantasy/animals-waterlife/SELF_AUDIT.md`
- `feod/output/fantasy/animals-waterlife/worldscale-1to1.png`
- `feod/output/fantasy/animals-waterlife/worldscale-qa.json`
- `feod/output/fantasy/animals-waterlife/worldscale-wip.js`

Сам STOP_HANDOFF.md и owned-files.sha256 также принадлежат этой ветке. Полный список SHA — owned-files.sha256.
