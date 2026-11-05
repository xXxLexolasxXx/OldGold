from PIL import Image
from collections import deque
from pathlib import Path
import json
out=Path(r'D:/для игры/feod/output/fantasy/directional-forest-golem-20261105')
for family,rows in [('golem',8),('troll',9)]:
 im=Image.open(out/f'{family}-authored-parts-v1.png').convert('RGBA');w,h=im.size;p=im.load();seen=bytearray(w*h);cs=[]
 for y in range(h):
  for x in range(w):
   i=y*w+x
   if seen[i] or p[x,y][3]<220:continue
   q=deque([(x,y)]);seen[i]=1;xs=[];ys=[]
   while q:
    xx,yy=q.popleft();xs.append(xx);ys.append(yy)
    for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
     nx,ny=xx+dx,yy+dy
     if 0<=nx<w and 0<=ny<h and not seen[ny*w+nx] and p[nx,ny][3]>=220:seen[ny*w+nx]=1;q.append((nx,ny))
   if len(xs)>800:cs.append({'pixels':len(xs),'bbox':[min(xs),min(ys),max(xs)+1,max(ys)+1]})
 cs.sort(key=lambda a:(a['bbox'][1]+a['bbox'][3])/2)
 if len(cs)!=5*rows:raise ValueError((family,len(cs),cs))
 atlas=Image.new('RGBA',(640,128*rows));meta={'family':family,'sourceSize':im.size,'cell':128,'views':['S','SE','E','NE','N'],'parts':{}}
 names=['head','torso','upper','lower','hand','thigh','shin','foot']+(['club'] if family=='troll' else [])
 for row in range(rows):
  group=sorted(cs[row*5:row*5+5],key=lambda a:a['bbox'][0])
  for col,c in enumerate(group):
   part=im.crop(c['bbox']);sc=min(104/part.width,112/part.height);part=part.resize((round(part.width*sc),round(part.height*sc)),Image.Resampling.NEAREST)
   a=part.load()
   for yy in range(part.height):
    for xx in range(part.width):
     r,g,b,alpha=a[xx,yy];a[xx,yy]=(r,g,b,255) if alpha>=220 else (0,0,0,0)
   x=col*128+(128-part.width)//2;y=row*128+(128-part.height)//2;atlas.alpha_composite(part,(x,y));meta['parts'][names[row]+'|'+meta['views'][col]]={'rect':[x,y,part.width,part.height],'sourceBox':c['bbox']}
 atlas=atlas.quantize(colors=96,method=Image.Quantize.FASTOCTREE).convert('RGBA');atlas.save(out/f'{family}-rig-parts-pixel.png');(out/f'{family}-rig-parts.json').write_text(json.dumps(meta,indent=2))
 print(family,len(cs),atlas.size)
