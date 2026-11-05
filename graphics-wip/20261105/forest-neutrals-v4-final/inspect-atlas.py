from PIL import Image
import numpy as np
from scipy.ndimage import label, find_objects
from pathlib import Path
p=Path(r'D:/для игры/feod/output/publish/oldgold-pages-20261104/assets/fantasy/forest-neutrals-v4/pixie-rig-source.png')
im=np.array(Image.open(p).convert('RGBA'))
lab,n=label(im[:,:,3]>220)
out=[]
for i,s in enumerate(find_objects(lab)):
    count=int((lab[s]==i+1).sum())
    if count>200: out.append({'pixels':count,'box':[s[1].start,s[0].start,s[1].stop,s[0].stop]})
print(sorted(out,key=lambda x:-x['pixels'])[:30])
