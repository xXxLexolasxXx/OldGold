# ОСТАНОВКА НА СЕГОДНЯ · PENDING · НЕ В LIVE

По прямому распоряжению пользователя текущая работа сохранена, новый проход не начинается. Водный набор НЕ готов к релизу: после нового worldscale-уточнения обнаружены реальные расхождения видимого размера. Последняя функционально проверенная ревизия возвращена в свой JS-путь; незавершённая переделка сохранена отдельно в worldscale-wip.js (только node --check, без browser PASS). Это восстановление собственного проверенного файла из собственного сохранённого snapshot, не git reset/clean и не откат чужих правок.

Сводка на завершение дня: STOP_HANDOFF.md. Старые подписи «масштаб в игре сохранён» на прежних изображениях отозваны новой cold-native проверкой; PNG сохраняются как промежуточные материалы, не как scale PASS. Показ 1:1: worldscale-1to1.png; точные измерения: worldscale-qa.json.

---

# OldGold — водный набор

Подготовлен самостоятельный presentation-модуль `js/fantasy-published-waterlife.js` в актуальной `output/publish/oldgold-pages-20261104`. Он не подключён к production index: это действие ведущей. Версия игры, index, sw, changelog, native runtime и чужие renderer-файлы не менялись.

## Состав и изображения

Полный точный roster: `ROSTER.md` и `roster.json`. Морская группа: 15 animal/body forms плюс 2 friendly seafolk; shoal использует sprat. Дополнительно inland fish и шесть реальных видов fairy1: gold/red/blue и amber/pink/teal. Gull/corm, haunted fairy2 rus/vod, корабли и жемчужина не менялись.

`directions.png` — пять самостоятельных ориентаций каждого marine/seafolk body. `cycles.png` — все родные морские циклы. `compare.png` — текущая опубликованная модель и новая, при одинаковом увеличении. `fish.png` — шесть fairy1 рыб с реальным анфасом, обоими ¾, профилем и спиной. Везде есть русские подписи и оговорка о масштабе.

`preview.html` — интерактивный просмотр 17 marine/seafolk моделей, состояний и кадров на настоящем production runtime. Для открытия промежуточного стенда нужно раздавать корень `feod` через статический сервер и открыть `/output/fantasy/animals-waterlife/preview.html`; file:// не подходит для same-origin iframe. Нижняя строка намеренно показывает прежний body renderer, который не имел пяти ориентаций. Native виды с 2/4/6 кадрами повторяются в 12 временных слотах стенда — это не объявление 12 уникальных родных поз.

## Как сделаны модели

Это новые полные анатомические meshes в (forward, right, height), со сканированием граней в жёсткие пиксельные кластеры backing x2. Не используется сжатый анфас, голова поверх прежнего тела или перекраска native art. Каждое направление заново растеризуется с настоящими задними поверхностями и сортировкой глубины. Конечности, клешни, плавники, глаза, хвосты, рога, присоски, волосы, кисти, борода и предметы принадлежат новой геометрии. Радиальным животным не добавлены человеческие лица или ноги. Две native формы раковин сохранены.

У крупных serpent/tent/kraeye сохранены действующие desktop холсты/anchors из pxbeasts, а не маленькие номинальные значения seaart. На native mobile PX_FINE=1 сохранён его собственный размерный контракт; крупная анатомия масштабируется целиком, без обрезанного туловища.

Reference crab-imagegen-reference.png создана встроенным image_gen, сохранена в проекте без правок. Промпт в imagegen-prompt.txt. Это художественный reference, не скрытая runtime-зависимость. Все необходимые runtime-данные находятся в JS; requiredAssets пуст. В модуле есть ready/errors и явная проверка native dependencies.

## Контракты

Направление выбирается из существующих a, tx/ty, перемещения или face. Transient heading хранится только в WeakMap. Native состояния, AI, timers, hit windows, footprint, serialization и фазовые длительности не переписаны. Deferred draw callbacks сохраняют родные позиции, глубину списка и health bar кракена. Прежние водные/ночные glow и world splash callbacks остаются в native коде. Inland jump сохраняет native root trajectory, shadow и glint; новый body приведён к тому же центру дуги.

У stationary friendly seafolk и щупалец native хранит только face, поэтому игра выбирает существующие левые/правые направления. API умеет все восемь ракурсов, но модуль не выдумывает новый AI-поворот ради таблицы. Floating/jumping fairy1 fish используют те же native callbacks; narrow jump сохраняет raw 34×14 bitmap contract. Сглаживание нового rasterizer не используется; native fyBlit с дробным масштабом оставлен штатным.

Кэш LRU: ключ вид + состояние + восьмеричный ракурс + нормализованный native frame + размер; максимум 768 entries и 24 MiB RGBA. NativeN downsample также ограничен тем же кэшем. Raw timestamp в ключах нет. Повтор кадра возвращает тот же объект.

## Что проверено и что ещё требуется

`qa.json` — 3360 marine/seafolk кадров во всех восьми направлениях; каждый native animation/frame и договорённые размеры/anchors. Дополнительно 1152 настоящих вызова fishDraw/fishyDraw и 96 beDrawFish поз на frozen-объектах. Проверены крайние и промежуточные кадры, cache reuse и давление на лимиты; сериализованное seaLife до/после отрисовки сравнивается. Native функции не заглушались. Контрольные исходники и SHA модуля в manifest.json.

`mobile-qa.json` — все 304 комбинации marine/seafolk вид × состояние × направление на первом кадре, PX_FINE=1, с native размерными контрактами. Полный 3360-frame перебор выполнен на desktop; не выдавать mobile-проверку первого кадра за все mobile циклы.

QA запускалась на production index с однократной staged-инъекцией только этого модуля, serviceWorkers:block и ephemeral Node server из pages-compat/qa-static-server.cjs. Это НЕ production-index PASS после штатного подключения. Реальные native draw callbacks проверены на fixtures; это НЕ доказательство natural spawning или боевого попадания в живой игре.

Ведущей нужно: подключить модуль ровно один раз после native beasts/fairy1/seafolk/pxbeasts и соседних графических адаптеров; проверить полный index без addScriptTag на desktop/mobile; снять живые кадры воды/берега, прыгнувших рыб, night jelly glow, friendly dive, атаки змея и кракена с настоящими victim/FX anchors. Художественная приёмка уровня новой свиты Малгора остаётся отдельным пунктом, не автоматическим PASS от функциональных тестов. Не публиковать как уже принятый арт без просмотра фактических новых листов.

Запуск проверок из D:/для игры:
- node feod/output/fantasy/animals-waterlife/qa.cjs
- node feod/output/fantasy/animals-waterlife/qa-mobile.cjs
- node feod/output/fantasy/animals-waterlife/qa-preview.cjs

Файлы для интеграции и точные SHA перечислены в manifest.json. Никаких reset/clean/commit/push не выполнялось.
