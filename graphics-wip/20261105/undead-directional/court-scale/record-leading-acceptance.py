from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parent
C=P.parents[3]/'output/publish/oldgold-pages-20261104'
f=P/'SCALE_READY.json';m=json.loads(f.read_text(encoding='utf-8'))
for x in m['runtimeFiles']:assert hashlib.sha256((C/x['relativePath']).read_bytes()).hexdigest()==x['sha256']
m['review']['leadingTechnical']={
 'status':'PASS targeted independent technical review; BLOCKERS0',
 'reviewer':'pages_editor_adapter via leading thread 01a1a2b3-2a33-73b3-8aab-6f77e1d39b63',
 'sourceSha256':m['runtimeFiles'][0]['sha256'],
 'portraitSha256':m['runtimeFiles'][1]['sha256'],
 'scope':'Canonical desktop/mobile48frames+48contacts,55cachealiases, exact mirrors/root, NPC/clock preservation,2bodyportraitcrops, all assets and SHA exact',
 'limits':'Targeted independent review; not a second exhaustive5544frame run.'
}
m['review']['leadingAcceptance']={
 'status':'ACCEPTED for main by leading thread',
 'thread':'01a1a2b3-2a33-73b3-8aab-6f77e1d39b63',
 'sourceSha256':m['runtimeFiles'][0]['sha256'],
 'portraitSha256':m['runtimeFiles'][1]['sha256'],
 'scope':'Leading also visually inspected all11fiveviews/commonworld; golem -9.43% full profile width vs native fixed view accepted as non-blocking anatomy/projection difference; no width-identical claim or bbox-stretch.'
}
m['status']='ACCEPTED frozen current11court scale fix + related portrait crop; centralized main commit pending'
m['readyForLive']=True
m['published']=False
m['pushed']=False
m['centralCommitStatus']='PENDING leading main assembly with other neutral branch; owner instructed to stop after handoff, no shared-index writes.'
f.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
note='''

## Финальная приёмка ведущей

Получена на тех же court d7ab7987... / portrait2b320f... SHA. Независимый targetedtechnical pages_editor_adapter: BLOCKERS0; productiondesktop/mobile48frames+48contacts,55cachealiases,exactmirror/root,NPC/clock,2bodyportraitcrops,allassets/SHAexact. Это целевой отдельный прогон, не новый полный5544matrix.

Ведущая также визуально просмотрела все11fiveviews/commonworld и приняла widthaddendum голема как неблокирующую разницу проекции/анатомии. Полной идентичности ширины не заявляем, под bboxнерастягиваем. Текущий court/portrait принят для main. Общий commit/push выполняет ведущая после объединения текущего forestобразца; собственный общийgitindex не изменён, своегоcommitSHA у владелицы нет. Публикация в этой ветке не выполнялась. После этого handoff работа текущей владелицы остановлена; новых семейств/живности не начинала.
'''
f=P/'HANDOFF.md';f.write_text(f.read_text(encoding='utf-8')+note,encoding='utf-8')
f=P/'review.html';s=f.read_text(encoding='utf-8').replace('Итоговую интеграцию и commit выполняет ведущая. Публикация не выполнялась.','Ведущая приняла текущую версию для main после независимой технической сверки. Общий commit выполняется централизованно; в этой ветке публикация не выполнялась.');f.write_text(s,encoding='utf-8')
print('Accepted exact frozen SHA; centralized commit pending; no git-index or renderer writes.')
