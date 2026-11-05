from pathlib import Path
import subprocess,sys,json
root=Path(__file__).parent
jobs={'stork-flight-v1':12,'heron-flight-v1':12,'bat-flight-v1':9,'crow-ground-v1':14,'stork-ground-v1':3,'heron-ground-v1':2,'pichugi-ground-v1':22,'pichugi-flight-v1':12,'pichugiWinter-ground-v1':22,'pichugiWinter-flight-v1':12,'gull-flight-v1':12,'gull-idle-v1':12,'corm-flight-v1':12,'corm-idle-v1':12}
report=[]
for name,n in jobs.items():
 p=root/'candidates'/name
 r=subprocess.run([sys.executable,str(root/'atlas-inspect.py'),str(p)+'.png',str(p)+'.json',str(n)],capture_output=True,text=True)
 report.append({'source':name,'expectedColumns':n,'ok':r.returncode==0,'output':r.stdout.strip(),'error':r.stderr.strip()})
 print(name,'PASS' if r.returncode==0 else 'FAIL',flush=True)
(root/'atlas-inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if any(not r['ok'] for r in report):sys.exit(1)
