from pathlib import Path
import ast,hashlib,json,re
root=Path(__file__).parent
game=Path(r'D:\для игры\feod\output\publish\oldgold-pages-20261104')
module=game/'js/fantasy-published-birds.js'
text=module.read_text(encoding='utf-8-sig')
required=ast.literal_eval(re.search(r'const requiredAssets=(\[.*?\]);',text,re.S).group(1))
required.append('assets/fantasy-birds/extra-packs.json')
packs=json.loads((game/required[-1]).read_text(encoding='utf-8'))['packs']
for p in packs:required.extend([f"assets/fantasy-birds/{p['file']}.png",f"assets/fantasy-birds/{p['file']}.json"])
def record(p,role):
 b=p.read_bytes()
 return {'path':str(p).replace('\\','/'),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'role':role,'publishReady':False}
runtime=[record(module,'WIP renderer; DO NOT add to live index')]
for p in sorted((game/'assets/fantasy-birds').rglob('*')):
 if p.is_file():runtime.append(record(p,'required WIP asset' if p.relative_to(game).as_posix() in required else 'unused source/history; NOT runtime required'))
exclude={'OWNED_FILES_SHA256.json','OWNED_FILES_SHA256.tsv'}
reports=[record(p,'saved raw source / tool / report; NOT artistic acceptance') for p in sorted(root.rglob('*')) if p.is_file() and p.name not in exclude]
rgba=0
for name in required:
 if name.endswith('.json'):
  d=json.loads((game/name).read_text(encoding='utf-8'))
  if d.get('compiled'):rgba+=d['width']*d['height']*4
result={'status':'HOLD / WIP_NOT_FOR_LIVE','lastDirectUserMessage':'заканчивай','ownCommitCreated':False,'observedSharedBranch':'graphics/wip-20261105','observedSharedHead':'072dcd090d676c3b174dc77eea6e4fc913e7cb66','moduleSHA256':runtime[0]['sha256'],'productionIndexChanged':False,'independentReview':'NOT obtained','requiredAssets':required,'fixedDecodedAtlasRGBABytes':rgba,'cacheLimits':{'entries':1800,'rgbaBytes':24*1024*1024},'rendererScope':['owl','chicken','henbuff','goose','duck','woodpecker','goldGoose'],'remainingRendererScope':['crow','stork','stork chicks','heron','pichugi','winter pichugi','pheasant','gull','corm','fRaven','bats'],'runtimeFiles':runtime,'reportFiles':reports,'manifestExcludesItself':True}
(root/'OWNED_FILES_SHA256.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'OWNED_FILES_SHA256.tsv').write_text('sha256\tbytes\trole\tpath\n'+'\n'.join(f"{r['sha256']}\t{r['bytes']}\t{r['role']}\t{r['path']}" for r in runtime+reports)+'\n',encoding='utf-8')
print(json.dumps({'status':result['status'],'moduleSHA256':result['moduleSHA256'],'requiredAssets':len(required),'runtimeFiles':len(runtime),'reportFiles':len(reports),'fixedDecodedAtlasRGBABytes':rgba},ensure_ascii=False))
