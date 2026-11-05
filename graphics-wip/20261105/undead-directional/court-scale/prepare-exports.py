from pathlib import Path
P=Path(__file__).resolve().parent
D=P.parent.parent/'undead-01199/directions'
s=(D/'record-world.cjs').read_text(encoding='utf-8')
s=s.replace('top=home.y+home.h+3','top=home.y+home.h+6')
s=s.replace('Game.time=20+f/8;',"Game.time=20+f/8;if(typeof loreClose==='function')loreClose();")
(P/'record-world.cjs').write_text(s,encoding='utf-8')
s=(D/'export-gifs.cjs').read_text(encoding='utf-8')
(P/'export-gifs.cjs').write_text(s,encoding='utf-8')
s=(D/'export-three-quarter-proof.cjs').read_text(encoding='utf-8')
(P/'export-three-quarter-proof.cjs').write_text(s,encoding='utf-8')
