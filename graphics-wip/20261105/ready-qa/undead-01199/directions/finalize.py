"""Validate final directional reports and write a bounded integration handoff."""
import hashlib, json, shutil, zipfile
from pathlib import Path

P = Path(__file__).resolve().parent
ROOT = P.parents[3]
CANON = ROOT / 'output/publish/oldgold-pages-20261104'
def read(name): return json.loads((P/name).read_text(encoding='utf-8'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write(name, data): (P/name).write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

checks, cache, fx, prod, world = [read(n) for n in ['checks.json','cache-checks.json','fx-anchors.json','production-checks.json','world-checks.json']]
assert len(checks['checks']) == 11 and not checks['errors'] and not checks['assetsErrors']
assert all(c['total']==504 and c['anchorErrors']==0 and not c['clipped'] and c['partialAlpha']==0 and c['dimensions'] and c['distinctIdleDirections']==8 for c in checks['checks'])
assert cache['sameStateIdentity'] and cache['sameStateMissDelta']==0 and cache['sameStateHitDelta']==1000
assert cache['unusedGfMissDelta']==0 and cache['unusedGfHitDelta']==300 and cache['invalidInputMissDelta']==0
assert cache['distinctViewObjects']==cache['distinctViewPixels']==4 and cache['portraitMatches'] and cache['clearResetsBytes'] and not cache['badKeySchema']
assert cache['maxEntriesObserved']<=1200 and cache['maxRgbaBytesObserved']<=33554432
assert len(fx['checks'])==32 and not fx['errors']
assert len(prod['reports'])==2
for r in prod['reports']:
    c=r['checks']
    assert not r['errors'] and not r['failedAssets'] and c['totalFrames']==c['anchorChecks']==5544
    assert c['nativeCallbacks']==c['unchangedNpcObjects']==880 and c['assetsReady'] and not c['assetsErrors']
    assert c['allSixLoaded'] and c['injectedScripts']==0 and c['cache']['rgbaBytes']<=33554432
assert len(world['directionsObserved'])==8 and not world['errors'] and world['injectedScripts']==0
cycles=read('cycles/manifest.json')
assert len(cycles['actions'])==7 and len(cycles['kinds'])==11
latest_asset=(CANON/'assets/fantasy/court-bodies-v5-N.png').stat().st_mtime
for filename in ['checks.json','production-checks.json','court-directions.png','court-turns.gif','cycles/manifest.json','world-checks.json','eight-directions-in-game.mp4']:
    assert (P/filename).stat().st_mtime>latest_asset, 'stale final evidence: '+filename

source=CANON/'js/fantasy-darkcourt-polish.js'
files=['js/fantasy-darkcourt-polish.js']+['assets/fantasy/'+n for n in ['court-bodies-v4-pixel.png','court-arms-v4-pixel.png','court-bodies-v5-S.png','court-bodies-v5-E.png','court-bodies-v5-NE.png','court-bodies-v5-N.png']]
frozen={
 'fantasy-undead-polish.js':'f5776044f0358523439a47f4f2843b129ef564c85d9c027afca68df825d8ee86',
 'fantasy-echo-polish.js':'d9ca844300ecb53794dfa26d0c4ad320b780e230f93f8dddb2c5bc8d83377584',
 'fantasy-barrow-polish.js':'079c85870fc624517bad8899d6913aa30fdced831278efa244ff561bfc1ae28c',
 'fantasy-mimic-polish.js':'7aa79af268dc16339892443068225dfd6fbc1c7258ca8a4ebb7a513bfcc87305',
 'fantasy-published-owls.js':'c88b02bfd1665ce05315e73af76c129d9a04f1c68e65a9769e8e2ffbfb057c2a'}
for name, expected in frozen.items(): assert sha(CANON/'js'/name)==expected, 'coordinated frozen family changed: '+name
manifest={
 'status':'READY for combined review; no publication performed', 'baseline':'0.11.99', 'target':'0.12 graphics',
 'scope':'11 Malgor court models only; this supersedes their prior frontal approval',
 'globalRequirement':'All non-dwarf families require equivalent directional completion; other five accepted families remain frozen for leading-session coordination, not claimed complete by this handoff.',
 'version':checks['version'], 'kinds':[c['kind'] for c in checks['checks']],
 'independentViews':['S front','SE front three-quarter','E profile','NE rear three-quarter','N back'],
 'headings':['S','SE','E','NE','N','NW','W','SW'], 'mirroredPartners':{'NW':'NE','W':'E','SW':'SE'},
 'nativeFramesPerDirection':63, 'verifiedFrameViewCombinations':5544,
 'requiredFiles':[{'path':f,'sha256':sha(CANON/f)} for f in files],
 'publicArtifacts':['court-directions.png','court-turns.gif','eight-directions-in-game.mp4','review.html']+['cycles/'+k+'.gif' for k in cycles['kinds']],
 'proofs':['checks.json','cache-checks.json','fx-anchors.json','production-checks.json','world-checks.json','back-surface-fix.json','mage-back-surface-fix.json','cycles/manifest.json'],
 'frontalPortraitApi':"await FantasyDarkCourtPolish.ready; FantasyDarkCourtPolish.portrait('fMalgor1', nativeIdlePhase0to11)",
 'phaseIII':"FantasyDarkCourtPolish.portrait('fMalgor3', nativeIdlePhase0to11)",
 'cache':cache, 'nativeFxChecks':32, 'nativeCallbacksPerViewport':880,
 'saveState':'880/880 native draw callbacks leave actor JSON unchanged per viewport; turns use private WeakMap only',
 'pixelGrid':'backing x2, 0.5 world pixel; binary sprite alpha; native size/foot/hand/FX anchors retained',
 'backFixes':'Only N atlas cells 5,10 then 2,3 composited; other cells verified byte-identical at each stage. N rockling upper-arm material uses lower-stone piece to prevent rear amber eye-like marks.',
 'worldVideo':'Controlled QA actors in canonical native depth list, movement-derived headings; does not claim naturally occurring combat.',
 'frozenOtherModules':frozen, 'canonicalIndexEdited':False, 'published':False,
 'staticServiceProbe':'/coop-info 404 is an expected unmocked static-preview backend probe, not a missing graphics asset.'
}
write('DIRECTIONAL_READY.json',manifest)
write('STATUS.json',{'status':'11 court directional models complete, frozen for combined review','readyForCombinedQA':True,'published':False,'manifest':'DIRECTIONAL_READY.json','remainingGlobalScope':'Other non-dwarf families coordinated by leading session; not silently changed here.'})
names=['Прислужник тьмы','Рыцарь тьмы','Малгор I','Малгор III','Костяной слуга','Ожившая глыба','Страж огня','Страж льда','Страж костей','Страж теней','Страж-голем']
html='''<!doctype html><html lang="ru"><meta charset="utf-8"><title>Нечисть — ракурсы и анимации</title><style>body{margin:24px auto;max-width:1200px;background:#283a34;color:#efdfb8;font:18px Georgia}img,video{max-width:100%;image-rendering:pixelated}section{margin:36px 0}a{color:#e2bf71}</style><h1>Нечисть: ракурсы и анимации</h1><p>Анфас, 3/4 спереди, профиль, 3/4 сзади и спина. Восемь направлений в игре.</p><p>Увеличено для сравнения; масштаб в игре сохранён.</p><img src="court-directions.png" alt="Пять ракурсов одиннадцати существ"><section><h2>Повороты в движении</h2><img src="court-turns.gif" alt="Повороты всех существ"></section><section><h2>В игровом окружении</h2><p>Управляемая проверочная сцена в обычном рендерере игры; направление выбирается по движению персонажей.</p><video src="eight-directions-in-game.mp4" controls muted loop></video></section>'''
for kind,name in zip(cycles['kinds'],names): html+=f'<section><h2>{name}</h2><p>Покой, ходьба, атака, колдовство, урон, родные боевые фазы и гибель.</p><img src="cycles/{kind}.gif" alt="{name}: все состояния и направления"></section>'
html+='<p><a href="DIRECTIONAL_READY.json">Манифест проверок и файлов</a> · <a href="API_READY.md">API анфасного портрета</a></p></html>'
(P/'review.html').write_text(html,encoding='utf-8')
handoff=f'''# Court directional handoff — complete bounded scope

Eleven models, five independently drawn projections, eight headings and all 63 normalized native frame keys: **5,544 verified combinations**. Canonical module SHA256: `{sha(source)}`. All six required PNGs and their SHA256 are in [DIRECTIONAL_READY.json](DIRECTIONAL_READY.json).

The explicit front/rear three-quarter columns are visible in [court-directions.png](court-directions.png). [court-turns.gif](court-turns.gif), eleven seven-state GIFs and [review.html](review.html) show the complete presentation pass. [eight-directions-in-game.mp4](eight-directions-in-game.mp4) uses controlled QA actors in the canonical game's depth list, with headings inferred from motion; this is a renderer demonstration, not a claim of naturally occurring combat.

Native world dimensions, feet and near/far hand/cast anchors are retained for all 5,544 combinations. Native Malgor glow transforms passed 32 actual gradient-centre checks. Canonical desktop/mobile each passed 880 native draw callbacks with actor JSON unchanged, no module injection, no JS errors or missing graphics assets. The static `/coop-info` probe returns expected 404 without a backend.

Cache keys are `kind|nativeFrame|canonicalView|booleanMirror`; maximum 1,200 entries and 32 MiB RGBA. 1,000 identical-state calls and 300 changes to unused `gf` caused zero extra misses. S/E/N/NE have separate objects and pixels. Invalid frame/view inputs normalize to a finite key set. Clear resets accounted bytes.

Frontal UI API is stable: `await FantasyDarkCourtPolish.ready`, then `portrait('fMalgor1', phase)` (native idle 0..11); phase III uses `fMalgor3`. See [API_READY.md](API_READY.md). S is a genuine front drawing. Both back-only corrections preserve this portrait and all other projection PNGs.

Final rear cleanup changes only N cells 5/10 (rockling/golem faceless rear plates), then 2/3 (remove front skull necklaces from mage backs), with byte-preservation proofs per stage. N rockling alone uses non-amber upper-arm material. No broader art pass followed.

The other five accepted renderer families are SHA-verified unchanged. The new global demand for all non-dwarfs is acknowledged; their further directional work needs leading-session coordination and is not represented as complete here. Canonical index, deployment and gameplay were not changed. No publication performed.
'''
(P/'HANDOFF.md').write_text(handoff,encoding='utf-8')
batch_path=P.parent/'BATCH_READY.json'
batch=json.loads(batch_path.read_text(encoding='utf-8'))
for m in batch['modules']:
    if m['path']=='js/fantasy-darkcourt-polish.js': m['sha256']=sha(source)
batch['directionalCourt']={'manifest':'directions/DIRECTIONAL_READY.json','scope':'11 court models only','supersedes':'COURT_V3_READY.json','readyForCombinedQA':True}
batch['globalDirectionalScopeComplete']=False
batch_path.write_text(json.dumps(batch,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Keep the owned source copy aligned; do not alter other accepted modules.
shutil.copy2(source, ROOT/'js/fantasy-darkcourt-01199-polish.js')
with zipfile.ZipFile(P/'court-directional-review.zip','w',zipfile.ZIP_DEFLATED) as z:
    for f in files: z.write(CANON/f,'runtime/'+f)
    evidence=['DIRECTIONAL_READY.json','STATUS.json','HANDOFF.md','API_READY.md','IMAGEGEN_PROMPTS.md','review.html','court-directions.png','court-turns.gif','eight-directions-in-game.mp4','production-desktop.png','production-mobile.png']+manifest['proofs']+['cycles/'+k+'.gif' for k in cycles['kinds']]
    for f in evidence: z.write(P/f,f)
print(json.dumps({'ready':True,'sourceSha256':sha(source),'models':11,'frameViews':5544,'archive':str(P/'court-directional-review.zip')},ensure_ascii=False))
