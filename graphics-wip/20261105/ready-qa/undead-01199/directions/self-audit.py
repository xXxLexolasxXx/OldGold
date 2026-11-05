import json, hashlib, datetime
from pathlib import Path
P=Path(__file__).resolve().parent
C=P.parents[3]/'output/publish/oldgold-pages-20261104'
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
m=read(P/'DIRECTIONAL_READY.json')
hashes=[dict(r,matches=sha(C/r['path'])==r['sha256']) for r in m['requiredFiles']]
assert all(r['matches'] for r in hashes)
production=read(P/'production-checks.json')
assert {r['mode'] for r in production['reports']}=={'desktop','mobile'}
for r in production['reports']:
    c=r['checks']
    assert not r['errors'] and not r['failedAssets'] and c['totalFrames']==c['anchorChecks']==5544
    assert c['nativeCallbacks']==c['unchangedNpcObjects']==880
    assert c['assetsReady'] and not c['assetsErrors'] and c['injectedScripts']==0
    assert c['cache']['rgbaBytes']<=c['cache']['maxRgbaBytes']
assert 'js/fantasy-darkcourt-polish.js' in (C/'index.html').read_text(encoding='utf-8')
cache=read(P/'cache-checks.json'); fx=read(P/'fx-anchors.json'); checks=read(P/'checks.json')
assert all(x['anchorErrors']==0 and not x['clipped'] and x['distinctIdleDirections']==8 for x in checks['checks'])
assert cache['sameStateMissDelta']==cache['unusedGfMissDelta']==cache['invalidInputMissDelta']==0
assert len(fx['checks'])==32 and all(x['aligned'] and x['stateUnchanged'] for x in fx['checks'])
gaps=[
 {'module':'fantasy-undead-polish.js','finding':'Only S/E/N native projections; no independently drawn front/rear three-quarter. Existing sprite field behaviour and cache byte accounting require a fresh directional audit.','status':'Not compliant with expanded directional standard; previous style acceptance only.'},
 {'module':'fantasy-echo-polish.js','finding':'No five-view/eight-heading directional API or separately drawn rear projections in this accepted legacy adapter. Cache byte cap/readiness contract need new pass.','status':'Not compliant with expanded directional standard; previous style acceptance only.'},
 {'module':'fantasy-barrow-polish.js','finding':'Native frame/phase cache, no five-view/eight-heading adapter. Count bound exists; explicit RGBA byte accounting and directional proof missing.','status':'Not compliant with expanded directional standard; previous style acceptance only.'},
 {'module':'fantasy-mimic-polish.js','finding':'Native chest state adapter lacks five independent projections and eight-heading selection. Map cache needs explicit count/byte limits and normalized public argument keys.','status':'Not compliant with expanded directional standard; previous style acceptance only.'},
 {'module':'fantasy-published-owls.js','finding':'Legacy owl adapter is not the new directional owl. Current owl work belongs to birds owner in fantasy-published-birds.js and must be checked there after integration.','status':'Superseded ownership: do not overwrite concurrent owl work.'}
]
report={
 'auditedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'rules':['D:/для игры/AGENTS.md','D:/для игры/GRAPHICS_RULES.md'],
 'currentOwnedScope':'11 Malgor court models; accepted legacy five-family package is explicitly not a complete directional package',
 'courtStatus':'PASS on actual canonical index desktop/mobile, without injection',
 'hashes':hashes,'production':production,
 'coverage':{'models':11,'independentDrawings':['S','SE','E','NE','N'],'headings':8,'nativeFrameKeys':63,'frameViewCombinations':5544,'nativeDrawCallbacksPerViewport':880,'nativeFxTransformChecks':32},
 'compliant':['Full body/material/limb/weapon redesign','backing x2 / world pixel step 0.5','separately authored front/front-quarter/profile/rear-quarter/back','native state and frame selectors retained','automatic movement/target heading with private WeakMap','layer order per view; far limb and rear weapon occlusion','faceless backs and no front mage medallions or golem chest core','native size/feet/hands/cast and glow anchors','finite normalized frame/view keys, 1200 entries and 32 MiB RGBA limit','frontal UI portrait API derives from actual body frame','same-state reuse, unique view pixels, byte accounting reset','no actor JSON mutation in 880 production callbacks per viewport'],
 'fixedInThisAudit':['Marked historical package acceptance as insufficient for expanded directional rules','Removed obsolete animal exclusion as an active instruction in legacy manifests; all animals included and assigned by leading session'],
 'previousVisualFixesVerified':['N rockling/golem faceless rear plates','N mage back necklaces removed','N rockling amber arm marks replaced','explicit front/rear three-quarter labels'],
 'remainingLegacyGaps':gaps,
 'coordination':'Legacy four non-owl source modules remain under earlier leading-session freeze pending ownership coordination; gaps are reported, not represented as fixed. Concurrent fairy/leshy/owl owners are not overwritten.',
 'mechanics':'This audit changes reports only; no renderer, AI, balance, timing, save, index or deployment mutation.',
 'animalRule':'All animals included by latest direct user instruction; obsolete exclusion cancelled.',
 'artifacts':['court-directions.png','court-turns.gif','cycles/manifest.json','eight-directions-in-game.mp4','checks.json','cache-checks.json','fx-anchors.json','production-checks.json','back-surface-fix.json','mage-back-surface-fix.json'],
 'subordinateAgents':[]
}
write(P/'SELF_AUDIT.json',report)
text='''# Самопроверка по общим правилам редизайна

**Малгор и 10 существ свиты соответствуют текущему directional-проходу.** Проверены фактические SHA исходника/шести PNG и повторно запущен полный canonical index на компьютере и телефоне без инъекции модуля: по 5 544 кадра/ракурса и 880 родных вызовов отрисовки, без ошибок графики и изменений JSON персонажей.

Пять самостоятельных проекций, восемь направлений, полный родной набор фаз, шаг пикселя 0,5, слои дальних/ближних частей, руки/оружие/эффекты и опоры подтверждены отчётами. Сохранены анфасный API портрета и ограничения кэша 1 200 записей / 32 МиБ. Сами рисунки и рендерер в этом аудите менять не потребовалось. Чистые задние поверхности и оба явно подписанных 3/4 видны на [листе](court-directions.png); все циклы и видео — в [просмотре](review.html).

**Весь прежний пакет этой ветки ещё не соответствует новым правилам.** У скелетов только три проекции; у эхо, курганного набора и мимиков нет пяти самостоятельных видов/восьми направлений. Для них также нужен новый проход по ограничениям памяти кэша и актуальным контрактам проверки. Прежние PASS относятся к старой художественной приёмке и не закрывают это требование. Старые модули оставлены под согласованной ведущей заморозкой; новая directional-работа требует согласования владельца. Сова уже находится у отдельного владельца птиц, её параллельные файлы не перезаписаны.

В этом аудите исправлены статусы старых манифестов и отменено устаревшее исключение животных. Все животные включены по последнему прямому поручению. Чужие феи/лешие/совы, UI, гномьи головы и дороги не менялись. Подчинённых исполнителей в этой ветке нет.

Точные результаты и оставшиеся недочёты: [SELF_AUDIT.json](SELF_AUDIT.json). Игровая механика, AI, тайминги и сохранения не менялись. Публикация не выполнялась.
'''
(P/'SELF_AUDIT.md').write_text(text,encoding='utf-8')
for name in ['BATCH_READY.json','FIVE_MODULES_READY.json']:
    f=P.parent/name
    if not f.exists(): continue
    old=read(f)
    if 'owlAuthorization' in old:
        old.setdefault('historicalOwlAuthorization',old['owlAuthorization'])
        old['owlAuthorization']='Superseded: all animals are included by latest direct user instruction. Owl directional redesign belongs to birds owner.'
    old['currentRulesAudit']='directions/SELF_AUDIT.json'
    old['globalDirectionalScopeComplete']=False
    old['legacyAcceptanceScope']='Historical style acceptance only; does not satisfy expanded directional requirements for skeleton/echo/barrow/mimic/legacy owl.'
    write(f,old)
print(json.dumps({'court':'PASS','legacyGaps':len(gaps),'audit':str(P/'SELF_AUDIT.md')},ensure_ascii=False))
