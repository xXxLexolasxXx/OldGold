import json
from pathlib import Path
p=Path(__file__).resolve().parent
f=p/'DIRECTIONAL_READY.json'
m=json.loads(f.read_text(encoding='utf-8'))
m['threeQuarterVisualProof']={'sheet':'court-both-three-quarters.png','malgorCloseup':'malgor-both-three-quarters.png','report':'three-quarter-proof.json','nativeCallbacks':78,'zoom':2,'perViewFit':False,'note':'Malgor native chase uses its existing hover/idle selector; retained without new mechanics.'}
f.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
f=p/'review.html'
s=f.read_text(encoding='utf-8')
marker='<section><h2>Повороты в движении</h2>'
section='<section><h2>Оба ракурса 3/4 в настоящих игровых кадрах</h2><p>Единое увеличение ×2; покой, движение и колдовство.</p><img src="court-both-three-quarters.png" alt="Передний и задний 3/4 всех существ"></section>'
if 'court-both-three-quarters.png' not in s: s=s.replace(marker,section+marker)
f.write_text(s,encoding='utf-8')
