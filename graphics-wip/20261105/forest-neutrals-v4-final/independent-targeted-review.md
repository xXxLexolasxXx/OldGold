# Независимый узкий технический review

Candidate: js/fantasy-published-forest-roster-v4.js SHA256 9bf8ce32cb30e76abec4109e9a2ec9f4b6164852d9a90cc7df20cb04664a6cec.

Вердикт: НЕ READY по трём локальным контрактным отклонениям. Runtime/index/git не изменялись.

1. Enderman cargo: холодный native sprEnder имеет soil center y=80−100=−20, концы корней 87/88−100=−13/−12 относительно feet anchor. Candidate cargo translateY=−12, roots end +9 дают −3: нижний корень на 9 world ниже. Union bbox не доказывает cargo root. Hand anchors относятся к отдельному контракту и этой ошибкой не опровергнуты. Узкая предложенная коррекция soil−20/root+8→−12 соответствует native нижнему корню; изменённую крону следует проверить отдельно.
2. Brownie peek: native fyBlit округляет root; doorX=10 даёт rawX310.4 →310, candidate directdraw сохраняет310.4. Native Y344, depth10.85 и alpha0.6833333333333333 совпадают. В записанном cold callback спрайт динамически берётся через текущий sprBrownie; поэтому размеры padded sprite не являются cold pixel baseline. Доказательство нарушения округления относится к фактической матрице/root, а не сравнению этих bitmap.
3. GarB: Game.time=2, ph=0, lit=true. Native chain start (111.82073549240395,180.6), candidate (111.4,180.6); end (111.4,184.6) совпадает. Утрачен native turn*.5 по X начала цепочки. Это draw/attachment contract, не AI.

Byte provenance: inverse patch только staff(.35,−2.05)→(.3,−2) и удаление одного trailing CRLF в памяти дал SHA73f11522e16352f0242d9862ca569d7939c897e555688a0c39508518320b1f41. Исторический файл не изготавливался. Таким образом предоставленный diff подтверждён независимо.

Ready=true, assetErrors=[], static 77858784 из100663296 bytes; sampled cache213760 из50331648 bytes. Это проверка текущего fixture, не стресс-тест полного бюджета. Код ограничивает LRU512 entries/48MiB, static96MiB. Owner3496 не переобозначается независимым полным прогоном. Изменений AI/stats/save schemas в рассмотренных обёртках не обнаружено; полнота replay/native clocks отдельно не утверждается.

Fixture: independent-targeted-contracts.cjs; raw traces: independent-targeted-contracts.json. Own ephemeral Node HTTP server, serviceWorkers blocked, candidate injected for review. Production index ещё не содержит candidate: production integration PASS не присваивается. Визуальные root/peer gates не заменяются этим техническим review.
