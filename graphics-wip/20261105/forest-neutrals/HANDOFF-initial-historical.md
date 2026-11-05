# Лесные нейтралы — передача ведущей

Статус: отдельный кандидат на интеграцию. Основной index не изменён. Полный production-index PASS не заявляется: подключение оставлено ведущей согласно границе задачи. Прежний профильный PASS не использован как доказательство новых ракурсов.

## Подключение

После остальных fantasy-модулей, включая fantasy-published-portraits.js:

```html
<script src="js/fantasy-published-forest-neutrals.js"></script>
```

Файл: `D:/для игры/feod/output/publish/oldgold-pages-20261104/js/fantasy-published-forest-neutrals.js`.

SHA256: `9A4EE223FCC69988B58A315FBC5D05502203B35BD166D880F29CB983C76475A3`.

Обязательных внешних runtime-ассетов нет: полные модели растеризуются из нового renderer. `FantasyForestNeutrals.ready === true`, `assetErrors` — явный массив, сейчас пустой. Иллюстрация `pixie-imagegen-reference.png` создана встроенным imagegen как художественный ориентир; она НЕ является игровой текстурой и НЕ подменяет снимки игровых кадров.

## Фактический состав и вызовы

| Модель | Родная точка | Родные состояния |
|---|---|---|
| Цветочная фея, pixie | neuDraw → naFrame | NA_ALL 75, отдельные parry 6 / roar 12; cast 12, curse 12, sleep 12 |
| Лесная фея, fairy | neuDraw → naFrame | тот же набор, отдельный лесной костюм, плащ и листовая корона |
| Нейтральный леший, leshy | neuDraw → naFrame | NA_ALL 75 + parry 6 / roar 12 |
| Лепрекон | lepDraw → lepFrame | i12, w12, танец16, tug3, steal4, slap9 = 56; оба родных промежуточных коэффициента .33 / .67; potB/potF, rainbow |
| Домовой, fairy.bw | brownieDraw → sprBrownie | одна родная статическая модель; родные появление/альфа, глаза в темноте, молоко и работа сохранены |
| Долговяз, fairy.end | endermanDraw → sprEnder(carry) | два родных варианта: без дерева / с деревом; roam/goto/dig/carry, bob, blink и исчезновение остаются родными |
| Горгульи A / B / C | garDraw → garA / garB / garC | восемь фаз крыла; дневные/ночные глаза и родные составные фонари |

Сверено с `pages-compat/nongnome-roster-delegation.json` и текущими native-файлами движка 0.11.99. Нейтральный leshy не является FZ les. Fairy1 brownie/enderman не заменяются вымышленными лесными видами. Животные, призраки, тролли, spore и ресурсные деревья не менялись.

## Устройство

Пять отдельных поверхностей S / SE / E / NE / N; SW / W / NW — парные зеркала. Контур головы, плечи и конечности, передние/задние материалы и аксессуары выбираются по виду. Задние поверхности не рисуют глаза и рот. Одежда, крылья, руки, ноги, кисти, волосы, оружие и груз рисуются заново.

Размеры холстов и точки опоры из NA_SPEC / LEP_SPEC / LEP_POT и native fairy1 сохранены. Backing 2×; горшок возвращает native 1× холст, поскольку его caller использует natural-size drawImage. Внешние точки горшка, радуги, слитка, родные IK кистей лепрекона, жертвы и FX не перенесены в новый конвейер. Руки фей и лешего доходят до исходных wrist/wand endpoints текущего presentation renderer.

Направление — из движения либо существующей цели; история в WeakMap. Модуль не меняет NPC, AI, save, баланс или таймеры. Native вызовы продолжают выполнять свои собственные штатные действия, например клиентский lep evSeen.

Кэш LRU: максимум 768 записей и 48 MiB RGBA. Ключ — вид / направление / native кадр; у лепрекона native .33/.67 сохраняются точно, произвольные preview-коэффициенты нормализуются. У горгулий фаза 0…7 и яркость глаз 0…4. Сырых timestamps в ключах нет.

## Доказательства

- `before/` — архив текущих профильных модулей и native fairy1 / leprechaunart / gargoyle до работы этой ветки.
- `qa-first-set.json` — фактический прогон кадров, края, пустые спрайты, кэш, ошибки browser.
- `first-set-sprites.png` — реальные игровые спрайты фей и лешего во всех восьми направлениях.
- `other-sprites.png` — лепрекон, домовой, долговяз с/без дерева, горгульи.
- `before-after.png` — честное сравнение с текущими профильными renderer до этой ветки, одинаковый мировой масштаб колонок.
- `native-composites.png` — вызовы настоящих lepDraw / garDraw с горшком, радугой, погружением и фонарями; гном-жертва на этом отдельном листе не добавлялся.
- `cycles/` — все native циклы по каждому из пяти исходных ракурсов; названия по-русски.
- `native-scene.png`, `native-scene-mobile.png` — эпизодическая репетиция в настоящем village renderer, отдельные specimens добавляются только в список глубины, не в Game NPCs.
- `qa.cjs` — воспроизводимый own ephemeral Node server + Chrome / Playwright, serviceWorkers:block. Заглушек отсутствующих native функций нет. Модуль подключается один раз в изолированной репетиции через addScriptTag, production index на диске не правится.

## Видимые ограничения и следующий контроль

Домовой в самой игре остаётся статическим существом у печки: исходный actor не имеет движения/ориентации. Renderer предоставляет все восемь видов, runtime использует анфас. Долговяз использует родные две статические модели с native bob, без выдуманных циклов боя. Горгульи являются неподвижными частями фонарей: в мире поворот выбирается по родному взгляду, а не из несуществующего движения; все поверхности доступны через API.

У горгульи B консоль и цепь сохраняют родное правое положение; native взгляд выбирает E/SE/NE без отражения архитектурного узла. Полные зеркальные виды остаются в model API для просмотра.

Финальная художественная приёмка пользователем и проверка полного production index после штатного script tag ещё необходимы. Это локально проверенный графический кандидат, а не заявление о выпуске 0.12.0. Соседние модули, index/sw/changelog/версия не изменены. Коммитов и push нет.

Последняя проверка сохранённого SHA: ошибки renderer/browser 0, пустых кадров 0, касаний краёв холста 0. Проверены 1032 кадра pixie, 1032 fairy, 744 leshy, 448 основных кадров лепрекона, 8 домового, 16 долговяза и 384 комбинации горгулий (8 фаз × 3 облика × 8 направлений × 2 крайних яркости глаз). Дополнительно проверены родные .33/.67 переходы сценок, оба слоя горшка, отсутствие мутаций тестовых нейтрала/лепрекона/долговяза и выбор всех 8 направлений. Итоговый новый кэш в момент контрольного среза: 415 записей / 50 239 232 байта при пределе 50 331 648 байт.

## Публичный API для проверки

`frame(kind, nativeFrame, heading)`, `lepFrame(nativeFrame, heading)`, `brownieFrame(heading)`, `enderFrame(carry, heading)`, `garFrame(style, wingPhase, heading, eyeLevel)`, `stats()`, `clear()`, `ready`, `assetErrors`.

Для будущего портрета нужно брать `frame(kind,'i0','S')` или соответствующий S API этого же body renderer, отдельную голову не рисовать. В проверенном portraits-модуле собственного UI-портрета этих видов не обнаружено.

## Промпт imagegen

Use case: stylized-concept. Create production fantasy pixel art model sheet for a kind peaceful woodland pixie woman, whole body, tiny copper-red braided hair, cream moth wings with rose markings, rose petal tunic, leaf collar, acorn satchel, twig wand, bare hands, leaf slippers. Crisp clustered pixel art, dark brown outlines, 4-tone material shading, top left lighting, no smooth gradients or vector look. Five equally spaced figures on one horizontal row, exactly front, front three-quarter facing right, right profile, rear three-quarter facing right, true back. Same proportions and ground line, complete feet and wand and wings inside each cell. Back views must have no facial features and no chest clasp; show back braids and wing roots. Friendly gentle expression. True transparent background, no text or labels, no ground shadow. Detailed polished sprite quality for fantasy strategy game. This is a reference model sheet, not a screenshot.
