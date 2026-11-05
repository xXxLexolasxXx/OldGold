"""Inspect PNG alpha components; write crop metadata without editing the source image."""
import sys,json
from PIL import Image
im=Image.open(sys.argv[1]).convert('RGBA'); w,h=im.size; p=im.load(); seen=set(); parts=[]
for y in range(h):
 for x in range(w):
  if (x,y) in seen or p[x,y][3]<96: continue
  queue=[(x,y)];seen.add((x,y));n=0;x0=x1=x;y0=y1=y
  while queue:
   xx,yy=queue.pop();n+=1;x0=min(x0,xx);x1=max(x1,xx);y0=min(y0,yy);y1=max(y1,yy)
   for nx,ny in ((xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)):
    if 0<=nx<w and 0<=ny<h and (nx,ny) not in seen and p[nx,ny][3]>=96:
     seen.add((nx,ny));queue.append((nx,ny))
  if n>1000:parts.append([x0,y0,x1-x0+1,y1-y0+1,n])
cols=int(sys.argv[3]);rows=[]
for r in range(5):
 group=sorted([b for b in parts if int((b[1]+b[3]*.5)/h*5)==r],key=lambda b:b[0])
 if len(group)!=cols:
  print(json.dumps({'row':r,'expected':cols,'found':len(group),'boxes':group}),flush=True)
  raise ValueError(f'row {r}: {len(group)}, expected {cols}')
 rows.append([b[:4] for b in group])
out={'width':w,'height':h,'columns':cols,'rows':rows,'alphaCut':96,'components':len(parts)}
with open(sys.argv[2],'w',encoding='utf-8') as f:json.dump(out,f,indent=2)
print(f'{len(parts)} isolated sprites, {w}x{h}')
