from PIL import Image
from pathlib import Path
import json
out=Path(r'D:/для игры/feod/output/fantasy/directional-forest-golem-20261105')
for fam in ['golem','troll']:
 for view in ['S','SE','E','NE','N']:
  im=Image.open(out/f'{fam}-source-{view}.png').convert('RGBA');w,h=im.size;im=im.resize((round(w*160/h),160),Image.Resampling.NEAREST)
  px=im.load()
  for y in range(im.height):
   for x in range(im.width):
    r,g,b,a=px[x,y];px[x,y]=(r,g,b,255) if a>=220 else (0,0,0,0)
  im=im.quantize(colors=64,method=Image.Quantize.FASTOCTREE).convert('RGBA');im.save(out/f'{fam}-{view}-pixel.png')
print('10 native-scale source cutouts, hard alpha, 64 colour palette each')
