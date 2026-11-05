from PIL import Image
from pathlib import Path
import json,statistics
out=Path(r'D:/для игры/feod/output/fantasy/directional-forest-golem-20261105')
for fam in ['golem','troll']:
 im=Image.open(out/f'{fam}-rig-parts-pixel.png').convert('RGBA');meta=json.loads((out/f'{fam}-rig-parts.json').read_text())
 for v in ['S','SE','E','NE','N']:
  x,y,w,h=meta['parts']['head|'+v]['rect'];p=im.crop((x,y,x+w,y+h));pts=[]
  for yy in range(h):
   for xx in range(w):
    r,g,b,a=p.getpixel((xx,yy))
    if a>200 and r>150 and 70<g<190 and b<90 and r>g*1.2 and yy/h>.4:pts.append((xx/w,yy/h))
  print(fam,v,(round(statistics.mean(z[0] for z in pts),3),round(statistics.mean(z[1] for z in pts),3)) if pts else None)
