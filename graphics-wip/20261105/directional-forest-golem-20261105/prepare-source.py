from PIL import Image
from collections import deque
from pathlib import Path
import json
out=Path(r'D:/для игры/feod/output/fantasy/directional-forest-golem-20261105')
im=Image.open(out/'authored-five-view-source-v1.png').convert('RGBA');w,h=im.size;p=im.load();seen=set();comps=[]
for y in range(h):
 for x in range(w):
  if (x,y) in seen or p[x,y][3]<220:continue
  q=deque([(x,y)]);seen.add((x,y));xs=[];ys=[]
  while q:
   xx,yy=q.popleft();xs.append(xx);ys.append(yy)
   for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
    nx,ny=xx+dx,yy+dy
    if 0<=nx<w and 0<=ny<h and (nx,ny) not in seen and p[nx,ny][3]>=220:seen.add((nx,ny));q.append((nx,ny))
  if len(xs)>5000:comps.append({'pixels':len(xs),'bbox':[min(xs),min(ys),max(xs)+1,max(ys)+1]})
comps.sort(key=lambda c:(c['bbox'][1]//(h//2),c['bbox'][0]));print(comps);(out/'component-bounds.json').write_text(json.dumps(comps,indent=2))
for i,c in enumerate(comps):
 family='golem' if c['bbox'][1]<h/2 else 'troll';j=i if i<5 else i-5
 crop=im.crop(c['bbox']);crop.save(out/f'{family}-source-{["S","SE","E","NE","N"][j]}.png')
