from pathlib import Path
p=Path(r'D:\для игры\feod\output\publish\oldgold-pages-20261104\js\fantasy-published-birds.js')
s=p.read_text(encoding='utf-8')
a=s.index(' const palettes=');b=s.index(' function cached(')
s=s[:a]+" function kit(w,h){const cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;cv.fine=2;return{cv,c:cv.getContext('2d')};}\n"+s[b:]
s=s.replace('}else owl(K,view,anim,f,opts.blink,opts.look);',"}else return beforeOwl(anim==='fly'?'fly':'perch',opts.look||0,!!opts.blink,anim==='fly'?10+f:0);")
s=s.replace("function direction(o,defaultView='E')","function direction(o,defaultView='S')")
s=s.replace("o.state==='perch'?(o.look?'SE':'S'):undefined",'undefined')
p.write_text(s,encoding='utf-8')
