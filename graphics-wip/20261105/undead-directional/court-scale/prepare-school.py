from pathlib import Path
P=Path(__file__).resolve().parent
s=(P/'record-world.cjs').read_text(encoding='utf-8')
s=s.replace('R.cam.z=1.65','R.cam.z=1.2').replace('(top+1.4)*TILE','(top-2)*TILE')
s=s.replace("'world-frames'","'school-frame'").replace("'world-'+f+'.png'","'school-scene.png'").replace("'world-checks.json'","'school-checks.json'")
s=s.replace('f<128','f<1').replace('frames:128','frames:1').replace('assert(headings.size===8)','assert(headings.size>=1)')
(P/'school-scene.cjs').write_text(s,encoding='utf-8')
