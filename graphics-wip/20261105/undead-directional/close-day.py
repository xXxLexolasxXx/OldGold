import json,hashlib,datetime
from pathlib import Path
P=Path(__file__).resolve().parent
F=P.parents[2]
C=F/'output/publish/oldgold-pages-20261104'
D=P.parent/'undead-01199/directions'
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
scale=load(D/'court-native-scale.json')
assert scale['sourceSha256']==sha(C/'js/fantasy-darkcourt-polish.js')
for name in ['DIRECTIONAL_READY.json','SELF_AUDIT.json','STATUS.json']:
    f=D/name;m=load(f)
    m['coldNativeScaleGate']='PENDING / FAIL: cold original visible profile height differs by 14–31%; see court-native-scale.json'
    m['readyForLive']=False
    m['dayClose']='Stopped after current measurement step by direct user instruction; no art, runtime, engine, index, version or deployment edits in this close-out.'
    if name=='DIRECTIONAL_READY.json':m['status']='Directional/frame/anchor QA passed; native visible scale gate unresolved; NOT ready for live'
    if name=='SELF_AUDIT.json':m['courtStatus']='Directional/frame/anchor PASS; newer cold native visible scale gate FAIL/PENDING; previous general compliance wording superseded'
    if name=='STATUS.json':m['status']='Saved for day close; native scale correction pending'
    write(f,m)
note='\n\n## Дополнение при закрытии дня — проверка масштаба\n\nНовое сравнение с холодным исходным `foePxFrame` выявило увеличение видимой высоты профилей на 14–31%. Размер canvas сам по себе не доказывает сохранение масштаба. Предыдущее общее утверждение о соответствии масштаба **отозвано**; directional/frame/anchor проверки остаются действительными, но публикационная готовность не подтверждена. [Сравнение 1:1](court-native-1to1.png), [одинаковое ×2](court-native-x2.png), [числа](court-native-scale.json). Полный bbox включает оружие/колпак; отдельный landmark головы и подошвы ещё требует проверки. Исходный renderer не имеет аргумента ракурса; это его настоящий базовый вид, а не придуманный «исходный профиль». Графику при завершении дня не меняла.\n'
for name in ['SELF_AUDIT.md','HANDOFF.md']:
    f=D/name;s=f.read_text(encoding='utf-8')
    if 'Дополнение при закрытии дня' not in s:f.write_text(s+note,encoding='utf-8')
f=D/'review.html';s=f.read_text(encoding='utf-8');warning='<p><strong>Проверка масштаба не закрыта:</strong> видимая высота профилей отличается от холодного исходного рендера на 14–31%. <a href="court-native-1to1.png">Сравнение 1:1</a>. До исправления не считать этот пакет готовым к live.</p>'
if 'Проверка масштаба не закрыта' not in s:s=s.replace('<h1>Нечисть: ракурсы и анимации</h1>','<h1>Нечисть: ракурсы и анимации</h1>'+warning)
f.write_text(s,encoding='utf-8')
for name in ['BATCH_READY.json','FIVE_MODULES_READY.json']:
    f=D.parent/name;m=load(f);m['readyForLive']=False;m['dayCloseManifest']='../undead-directional/DAY_CLOSE.json';m['courtColdScaleGate']='PENDING / FAIL; directions/court-native-scale.json';write(f,m)
runtime=['js/fantasy-darkcourt-polish.js','js/fantasy-undead-polish.js','js/fantasy-echo-polish.js','js/fantasy-barrow-polish.js','js/fantasy-mimic-polish.js']
assets=['court-bodies-v4-pixel.png','court-arms-v4-pixel.png','court-bodies-v5-S.png','court-bodies-v5-E.png','court-bodies-v5-NE.png','court-bodies-v5-N.png']
artifacts=['DIRECTIONAL_READY.json','STATUS.json','SELF_AUDIT.md','SELF_AUDIT.json','HANDOFF.md','API_READY.md','IMAGEGEN_PROMPTS.md','checks.json','cache-checks.json','fx-anchors.json','production-checks.json','world-checks.json','court-directions.png','court-turns.gif','court-both-three-quarters.png','malgor-both-three-quarters.png','three-quarter-proof.json','cold-native-scale.cjs','court-native-scale.json','court-native-1to1.png','court-native-x2.png','review.html','eight-directions-in-game.mp4']
report={
 'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'status':'STOPPED FOR DAY by direct user instruction; all current results saved; shared publication checkout, no parallel git add/commit',
 'runtimeFiles':[{'path':str(C/f),'sha256':sha(C/f)} for f in runtime],
 'courtAssets':[{'path':str(C/'assets/fantasy'/f),'sha256':sha(C/'assets/fantasy'/f)} for f in assets],
 'court':'b6d63620aba06e378a2a88e26ef71b7f094edde4e8e67edc3c99defb0083d077; five projections/eight headings/native actions exist and passed QA, but native visible scale gate unresolved, not ready for live',
 'passed':['5544 frame/view combinations, no partial sprite alpha/clipping/hand anchor error','desktop/mobile canonical index, no injection, 880 unchanged NPC JSON callbacks each','32 native glow transform checks','finite cache, max1200 entries/32MiB, repeated state reuse','78 actual native callbacks for explicit front/rear three-quarter sheet without clipped FX or state mutation'],
 'knownDefects':scale['findings'],
 'pending':['Court: correct uniform world size using cold native visible body/head/foot reference; preserve native hand/FX points, all five views use one scale. No redraw done today.','Skeleton prototype: only cold native capture and prior source backup; no new directional runtime authored or integrated.','Four skeleton looks, 42 echoes, 3 barrow forms, 10 mimics, spectral ghosts/reaper and FZ wisps remain a new directional scope. Previous frontal PASS is insufficient.'],
 'skeletonPrototypeFiles':[str(p) for p in sorted((P/'skeleton-prototype').iterdir()) if p.is_file()],
 'skeletonColdNative':load(P/'skeleton-prototype/cold-native.json'),
 'savedEvidenceFiles':[str(D/a) for a in artifacts],
 'doNotIncludeInLive':['Uncorrected court v5 native-size gate as a final release','Skeleton prototype/cold captures/baseline backup as runtime','Raw QA frames, scripts, reports, generated source images, review zips as live game assets','Any claim legacy skeleton/echo/barrow/mimic adapters meet expanded directional rules'],
 'separateOwners':'Owls and enemy raven owned by birds branch; fairies/leshy owned elsewhere; no edits to those concurrent source files.',
 'commit':'No own commit SHA: shared publication checkout. Leading thread 01a1a2b3-2a33-73b3-8aab-6f77e1d39b63 to save own listed files sequentially. Files remain on disk; no reset/clean/forcepush.',
 'indexVersionEngineDeploymentChanged':False,
 'archiveWarning':'Existing court-directional-review.zip predates this cold-scale addendum; retain as historical evidence, do not use its READY as current release gate.',
 'subagents':[]
}
write(P/'DAY_CLOSE.json',report)
(P/'DAY_CLOSE.md').write_text('''# Передача при завершении дня

Работа остановлена после сохранения текущего небольшого шага. Новые семейства не начинала. Публикацию и параллельный коммит в общем publication checkout не делала.

**Двор Малгора:** исходник SHA `b6d63620aba06e378a2a88e26ef71b7f094edde4e8e67edc3c99defb0083d077` и шесть PNG сохранены без новой перерисовки. Пять авторских проекций/восемь направлений, 5 544 фазовых сочетания, 880 native callbacks на desktop/mobile и 78 вызовов отдельного листа обоих 3/4 прошли проверки. Кэш и native anchors проверены.

**Блокирующее дополнение:** холодный исходный visible bbox показал, что профиль v5 выше на 14–31%. Прежнее утверждение о сохранённом масштабе по размерам буфера отозвано. Проверка масштаба не закрыта; не включать этот вариант в live как окончательно принятый до исправления. Новый [отчёт](../undead-01199/directions/court-native-scale.json), [1:1](../undead-01199/directions/court-native-1to1.png) и [×2](../undead-01199/directions/court-native-x2.png). Полный bbox включает оружие/колпак; отдельная отметка головы и подошвы ещё pending. Original foePxFrame не имеет аргумента направления: показан его реальный базовый вид.

**Скелет:** сохранены только baseline.js, cold-native.cjs/json/png в skeleton-prototype/. Холодный native E idle0: bbox [-8⅓,-41⅔,20⅓,1⅔], видимая высота 43⅓ мировых единиц; предыдущая переделка 44. Новый directional renderer ещё не написан, в игру не подключён. Это pending, не готовый прототип.

**Остальная очередь:** четыре скелета, 42 эхо, три курганные формы, десять мимиков, spectral ghosts/reaper и FZ wisps — новый незавершённый directional scope. Сову и вражеского ворона ведёт ветка птиц. Старые четыре модуля сохранены; новая работа их пока не меняла. Механики, engine, index, версия и публикация не менялись.

Точный список своих runtime/assets/evidence файлов, SHA и исключений из live: [DAY_CLOSE.json](DAY_CLOSE.json). Ведущая сохраняет snapshot последовательно; своего commit SHA нет из-за общего publication checkout. Raw QA frames и старый zip остаются на диске как промежуточные результаты; старый zip не содержит последнего scale addendum и не является текущим разрешением на выпуск.
''',encoding='utf-8')
print(json.dumps({'saved':str(P/'DAY_CLOSE.json'),'scaleGate':'pending','runtimeSha':report['runtimeFiles'][0]['sha256'],'commit':False},ensure_ascii=False))
