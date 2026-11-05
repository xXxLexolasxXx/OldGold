import json,hashlib,shutil,datetime
from pathlib import Path
P=Path(__file__).resolve().parent
F=P.parents[3]
C=F/'output/publish/oldgold-pages-20261104'
D=F/'output/fantasy/undead-01199/directions'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
files=['js/fantasy-darkcourt-polish.js','js/fantasy-published-portraits.js']
assert sha(C/files[0])=='d7ab7987e1383e5cc79105479ad7d9ba4d75ff45688451fb8d0d30aaffaa253b'
assert sha(C/files[1])=='2b320f632ec16c9ae75ddf144a83cc38d3cf144473da2c8159a8727368359dc0'
for name in ['checks.json','cache-checks.json','fx-anchors.json','production-checks.json','production-desktop.png','production-mobile.png']:
    assert (D/name).stat().st_mtime>(C/files[0]).stat().st_mtime, 'stale '+name
    shutil.copy2(D/name,P/name)
checks=read(P/'checks.json'); cache=read(P/'cache-checks.json'); fx=read(P/'fx-anchors.json'); prod=read(P/'production-checks.json'); scale=read(P/'court-native-scale.json'); crowns=read(P/'crown-checks.json'); world=read(P/'world-checks.json'); cycles=read(P/'cycles/manifest.json'); quarter=read(P/'three-quarter-proof.json')
assert checks['version']=='court-v6-native-scale' and not checks['errors'] and not checks['assetsErrors']
assert len(checks['checks'])==11 and all(c['total']==504 and c['anchorErrors']==0 and not c['clipped'] and c['partialAlpha']==0 and c['distinctIdleDirections']==8 for c in checks['checks'])
assert not scale['findings'] and not scale['pageErrors']
assert all(abs(x['profileHeightRatio']-1)<.035 and abs(x['profileTopDelta'])<=1 and abs(x['profileBottomDelta'])<=1.5 for x in scale['records'])
assert all(abs(v['delta'])<=.5 for x in crowns['records'] for v in x['views'].values())
assert cache['sameStateIdentity'] and cache['sameStateMissDelta']==cache['unusedGfMissDelta']==cache['invalidInputMissDelta']==0
assert cache['portraitMatches'] and cache['clearResetsBytes'] and cache['maxRgbaBytesObserved']<=33554432
assert len(fx['checks'])==32 and all(x['aligned'] and x['stateUnchanged'] for x in fx['checks'])
for r in prod['reports']:
    c=r['checks'];assert not r['errors'] and not r['failedAssets'] and c['totalFrames']==c['anchorChecks']==5544 and c['nativeCallbacks']==c['unchangedNpcObjects']==880 and c['assetsReady'] and not c['assetsErrors'] and c['injectedScripts']==0
assert len(world['directionsObserved'])==8 and not world['errors'] and world['injectedScripts']==0
assert len(cycles['kinds'])==11 and len(cycles['actions'])==7
assert quarter['sourceSha256']==sha(C/files[0]) and all(x['unchanged'] and not x['edge'] and x['visible'] for x in quarter['checks'])
portrait_source=F/'output/fantasy/pages-compat/portrait-sync'
for src,dst in [('mrak-frontal-v5.png','portrait-front.png'),('mrak-frontal-v5-checks.json','portrait-checks.json')]:shutil.copy2(portrait_source/src,P/dst)
portrait=read(P/'portrait-checks.json');assert portrait['portraitsSha256']==sha(C/files[1]) and not portrait['errors'] and not portrait['assetErrors'] and all(x['cropMatches'] and x['usesFrontSource'] for x in portrait['rows'])
scale['scaleGate']='PASS: all 11 profiles within 3.5% native visible height; crowns separately verified within 0.5 world pixel in all five projections; foot origin unchanged'
scale['nativeHeadLandmarkVerified']=True
scale['headVerification']='crown-checks.json; actual cold-native body crown, staff omitted only in Malgor QA fixture so staff cannot mask head-size errors'
scale['maximumCrownDelta']=max(abs(v['delta']) for x in crowns['records'] for v in x['views'].values())
scale['soleNotes']='World foot anchor remains [0,0]. Solid-foot visible idle E lower edge differs at most 2/3 world pixel. Robe/mist lower alpha fringe differs at most 4/3 world pixel; it is not a rigid foot.'
write(P/'court-native-scale.json',scale)
assets=['court-bodies-v4-pixel.png','court-arms-v4-pixel.png','court-bodies-v5-S.png','court-bodies-v5-E.png','court-bodies-v5-NE.png','court-bodies-v5-N.png']
old=read(D/'DIRECTIONAL_READY.json')
for a in assets:
    expected=next(x['sha256'] for x in old['requiredFiles'] if x['path']=='assets/fantasy/'+a)
    assert sha(C/'assets/fantasy'/a)==expected
review={
 'portrait':{'status':'APPROVED narrow crop-only review','reviewerThread':'01a1a35d-b114-75d2-9703-6c6079ac42d1','sourceSha256':sha(C/files[1]),'findings':'Both72x72 phases readable, hood top padding/face correct, no extra head; actual frontal body source retained; no concurrent edits. Does not approve entire court or other portraits.'},
 'forestPeer':{'status':'PENDING requested on final court SHA','thread':'01a1a8f8-afcc-7980-82aa-33983be85082'},
 'independentAudit':{'status':'PENDING requested on final court SHA','thread':'01a1a35e-054d-7e90-a775-88e1029b115b'},
 'leadingAcceptance':{'status':'PENDING','thread':'01a1a2b3-2a33-73b3-8aab-6f77e1d39b63'}
}
manifest={
 'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'FROZEN / self-QA PASS / independent court review pending','version':checks['version'],
 'scope':'Current 11 court models + one related mrak portrait crop; no new families or animals',
 'runtimeFiles':[{'path':str(C/f),'relativePath':f,'sha256':sha(C/f)} for f in files],
 'unchangedRequiredAssets':[{'path':'assets/fantasy/'+a,'sha256':sha(C/'assets/fantasy'/a)} for a in assets],
 'models':[c['kind'] for c in checks['checks']],'projections':['S front','SE front quarter','E profile','NE rear quarter','N back'],'headings':8,
 'scale':{'oneModelScaleForAllViews':True,'nativeHeightMaxRelativeError':max(abs(x['profileHeightRatio']-1) for x in scale['records']),'crownMaxWorldError':scale['maximumCrownDelta'],'footOrigin':[0,0],'physicalFootVisibleEdgeMaxError':2/3,'robeMistAlphaFringeMaxError':4/3,'outputPixelStep':.5,'smoothing':False},
 'nativeAnchors':'All 5544 actual arm/cast near/far hand points match approved native rig; 32 native glow transforms unchanged; no global model transform of hand/FX coordinates',
 'validated':{'frameViews':5544,'nativeCallbacksPerViewport':880,'unchangedNpcObjectsPerViewport':880,'fx':32,'quarterNativeCallbacks':len(quarter['checks']),'desktopMobile':True,'graphicsErrors':0,'canonicalIndexWithoutInjection':True,'cacheEntryCap':1200,'cacheRgbaByteCap':33554432,'nativeStatesInEachGif':cycles['actions']},
 'review':review,'readyForCombinedQA':True,'readyForLive':False,'published':False,'pushed':False,'ownerCommitPerformed':False,
 'commitProtocol':'Latest user coordination requires leading session to commit the two named runtime files sequentially in shared publication clone; owner does not touch shared git index.',
 'sourceChanges':'Per-kind uniform authored body/limb thickness calibration shared by all5views; original golem/ice sole level; original Malgor staff length/lift; native rig unchanged; ordinary-game preview gate removed after scale fix; portrait crop derives from current model height.',
 'knownLimits':['World video is a controlled renderer demonstration in the canonical depth list, not naturally occurring combat.','Artwork differs in shape/material from native; size proof uses visible silhouette and independent body crown, not exact old pigment pixels.','Independent court visual/technical review and leading acceptance are pending, cannot be replaced by self-QA.'],
 'remainingOtherScope':'Skeleton/echo/barrow/mimic/spectral/FZ redesign not started in this resumed scale-fix; no completion claimed. Animals/owls/raven excluded by latest rules.',
 'evidence':['comparison-1to1.png','comparison-x2.png','five-views.png','court-both-three-quarters.png','in-game-with-dwarves.mp4','world-0.png','world-40.png','school-scene.png','court-native-scale.json','crown-checks.json','checks.json','cache-checks.json','fx-anchors.json','production-checks.json','portrait-checks.json','portrait-front.png','cycles/manifest.json','three-quarter-proof.json','world-checks.json','school-checks.json']
}
write(P/'SCALE_READY.json',manifest)
shutil.copy2(C/files[0],F/'js/fantasy-darkcourt-01199-polish.js')
html='''<!doctype html><html lang="ru"><meta charset="utf-8"><title>Малгор — исправленный масштаб</title><style>body{margin:24px auto;max-width:1200px;background:#293935;color:#f0dfb9;font:18px Georgia}img,video{max-width:100%;image-rendering:pixelated}section{margin:32px 0}a{color:#dfbf79}</style><h1>Малгор и свита: исправленный масштаб</h1><p>Одна мировая шкала для пяти отдельных проекций. Кисти и эффекты сохраняют родные координаты.</p><p>Самопроверка прошла; независимая приёмка двора ожидается. Публикация не выполнялась.</p><section><h2>Сравнение 1:1</h2><img src="comparison-1to1.png" alt="Исходная и исправленная модель в мировом размере один к одному"></section><section><h2>Рядом с гномами</h2><p>Контролируемая проверочная сцена в обычном игровом рендерере.</p><img src="school-scene.png" alt="Малгор со свитой, гномы и школа"><video src="in-game-with-dwarves.mp4" controls muted loop></video></section><section><h2>Все ракурсы</h2><p>Увеличено для сравнения; масштаб в игре сохранён. Единое увеличение ×2.</p><img src="five-views.png" alt="Анфас, оба3/4, профиль и спина"><img src="court-both-three-quarters.png" alt="Передний и задний3/4 в родных игровых вызовах"></section>'''
names=['Прислужник тьмы','Рыцарь тьмы','Малгор I','Малгор III','Костяной слуга','Ожившая глыба','Страж огня','Страж льда','Страж костей','Страж теней','Страж-голем']
for kind,name in zip(manifest['models'],names):html+=f'<section><h2>{name}</h2><p>Покой, ходьба, атака, колдовство, урон, боевые фазы и гибель во всех направлениях.</p><img src="cycles/{kind}.gif" alt="{name}: анимации"></section>'
html+='<p><a href="SCALE_READY.json">Манифест SHA и проверок</a> · <a href="court-native-scale.json">Измерения масштаба</a></p></html>'
(P/'review.html').write_text(html,encoding='utf-8')
(P/'HANDOFF.md').write_text('''# Малгор: scale-fix V6

## Текущая замороженная версия

`js/fantasy-darkcourt-polish.js` SHA `d7ab7987e1383e5cc79105479ad7d9ba4d75ff45688451fb8d0d30aaffaa253b`.

`js/fantasy-published-portraits.js` SHA `2b320f632ec16c9ae75ddf144a83cc38d3cf144473da2c8159a8727368359dc0` — только связанная строка crop Малгора, проверена владелицей UI; пересекающихся изменений нет.

Шесть требуемых PNG не менялись. Материалы/отдельные рисунки пяти ракурсов сохранены. Одна поправка физического размера на существо, общая всем ракурсам, без fit под буфер. Опоры/кисти/FX не масштабируются. Посох Малгора возвращён к исходной длине и подъёму. Голем и ледяной страж опираются на исходный уровень подошвы. Портрет берёт фронтальную модель и её актуальную высоту.

## Доказательства

[Сравнение 1:1](comparison-1to1.png), [единое увеличение ×2](comparison-x2.png), [пять видов](five-views.png), [оба3/4](court-both-three-quarters.png), [рядом со школой/гномами](school-scene.png), [видео](in-game-with-dwarves.mp4), [просмотр всех циклов](review.html).

Cold-native полный профиль и отдельно body-crown Малгора без посоха проверены. Верх головы/венца во всех55проекциях отличается не более чем на1/6 мирового пикселя. Видимая высота профиля — в пределах3,5% исходной. Логическая опора стоп[0,0] неизменна; нижний край жёстких стоп отличается не более2/3worldpixel. У подола/дымки alpha-фрагменты до4/3pixel — это не твёрдая подошва. Native исходник не имел directional API; его реальный вид честно подписан, не выдан за отдельно нарисованный профиль.

5 544 кадра/ракурса без обрезаний, частичной alpha и ошибок anchors; по880родных callbacks desktop/mobile без изменений NPC JSON.32nativeFXцентра unchanged; кэш≤1200/32MiB, повторные состояния без дополнительныхmisses.78actualnativecalls обоих3/4безобрезки.11GIF показывают семь родных групп фаз. Нет script injection, отсутствующих PNG или JS ошибок. Ожидаемый /coop-info404 — статическая служебная проба.

## Независимая координация и выпуск

UI-владелица конкретно одобрила одну crop-строку/две72×72фазы на том же portrait SHA. Forest peer и Баганету направлены текущие sourceSHA,1:1,ракурсы,реальныйкадр/видео; независимый court review пока PENDING. Ведущая подтверждает окончательную приёмку на этих SHA. Самопроверка не заменяет их review. Новые семейства не начинались, живность не переделывалась.

По последнему порядку общий git index владелица набора не трогает: ведущая последовательно коммитит **только два перечисленных runtime-файла** и доказательства по своему протоколу. Не публиковать автоматически; пользователь попросил сначала показать. Runtime готов для combinedQA, release gate пока зависит от независимой сверки и ведущей. Полный список/SHA/статусы в [SCALE_READY.json](SCALE_READY.json). Прошлые DAY_CLOSE/SELF_AUDIT/ZIP сохраняются как исторические; этот handoff заменяет их court-scale PENDING, но не объявляет завершённым redesign прочих семейств.
''',encoding='utf-8')
# Link superseded reports without rewriting their historical measurements.
for file in [D/'DIRECTIONAL_READY.json',D/'STATUS.json',D/'SELF_AUDIT.json']:
    old=read(file);old['supersededCourtScaleBy']='../../undead-directional/court-scale/SCALE_READY.json';old['currentCourtScaleStatus']='V6 self-QA PASS; independent court review pending';write(file,old)
batch=D.parent/'BATCH_READY.json';old=read(batch)
for module in old['modules']:
    if module['path']=='js/fantasy-darkcourt-polish.js':module['sha256']=sha(C/files[0])
old['currentCourtScaleManifest']='../undead-directional/court-scale/SCALE_READY.json';old['readyForLive']=False;write(batch,old)
print(json.dumps({'frozen':True,'courtSha':sha(C/files[0]),'portraitSha':sha(C/files[1]),'crownMaxDelta':scale['maximumCrownDelta'],'peerReview':'pending'},ensure_ascii=False))
