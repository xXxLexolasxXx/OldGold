"""One physical scale per kind, shared by all five authored projections.
Hands, native pose selection, spell points, glow and world origins stay fixed.
"""
from pathlib import Path
import sys
P=Path(__file__).resolve().parent
C=P.parents[3]/'output/publish/oldgold-pages-20261104/js/fantasy-darkcourt-polish.js'
s=(P/'source-before-scale.js').read_text(encoding='utf-8')
s=s.replace("court-v5-eight-directions","court-v6-native-scale")
marker=" const assets={bodies:"
calibration=""" // Cold original foePxFrame i0 visible crown/sole reference, in world units.
 // This table is per MODEL, never per view or buffer. Do not scale hand/FX rig.
 const worldScale={
  fThrall:{height:35,base:43},fKnight:{height:48,base:58},
  fMalgor1:{height:68.6666666667,base:84},fMalgor3:{height:72.6666666667,base:84},
  fBone:{height:21.3333333333,base:26},fRock:{height:29,base:34},
  fG_fire:{height:45.6666666667,base:55},fG_ice:{height:45.6666666667,base:55},
  fG_bone:{height:42,base:55},fG_shadow:{height:42.6666666667,base:55},
  fG_golem:{height:68.3333333333,base:82}
 };
 for(const [kind,S]of Object.entries(specs)){const M=worldScale[kind];S.scale=M.height/M.base;S.h=M.height;S.w*=S.scale;}
"""
assert marker in s
s=s.replace(marker,calibration+marker)
# Leg/arm thickness uses the same model scale, while native joint/hand paths
# stay in world coordinates. Extend golem foot texture to the original sole.
s=s.replace("const p=parts.legs[i];segment", "if(kind==='fG_golem')f[1]+=3.5;if(kind==='fG_ice')f[1]+=1;width*=S.scale;const p=parts.legs[i];segment")
s=s.replace("const R=rig(kind,Q,s),A=partsFor(kind),S=specFor(kind),t=", "const R=rig(kind,Q,s),A=partsFor(kind),S=specFor(kind),t=")
s=s.replace("R.a=a;R.b=b;if(activeView", "R.a=a;R.b=b;R.w*=S.scale;if(activeView")
# Original crystal centre is -204/3 world units, lift -12/3 on cast.
# Preserve the actual hand and native glow transform rather than scaling them.
s=s.replace("top=-84+(cast?-1:0)+Q.br*.33", "top=-68+(cast?-4:0)+Q.br*.33")
s=s.replace("headings:headings8,anchors:", "headings:headings8,worldScale,anchors:")
if '--enable' in sys.argv:
    s=s.replace(" // Late cold-native audit found enlarged silhouettes. Keep the unfinished\n // directional pass available for review, outside the normal game.\n if(new URLSearchParams(location.search).get('courtPreview')!=='1')return;\n",'')
C.write_text(s,encoding='utf-8')
print(C)
