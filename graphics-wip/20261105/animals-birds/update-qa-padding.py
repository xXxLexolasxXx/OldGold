from pathlib import Path
root=Path(__file__).parent
p=root/'scale-audit.cjs';s=p.read_text(encoding='utf-8')
s=s.replace("const [w,h]=box,cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;", "const pad=B.frameInfo(s)?.padding||[0,0,0,0],cv=document.createElement('canvas');cv.width=s.width;cv.height=s.height;")
s=s.replace('g.drawImage(s,0,0,cv.width,cv.height);','g.drawImage(s,0,0);')
s=s.replace('bbox:[x0/2,y0/2,(x1-x0+1)/2,(y1-y0+1)/2],support:[sum/n/2,(y1+1)/2]', 'bbox:[x0/2-pad[0],y0/2-pad[1],(x1-x0+1)/2,(y1-y0+1)/2],support:[sum/n/2-pad[0],(y1+1)/2-pad[1]]')
s=s.replace('c.drawImage(now,90,y+40,w,h)','B.drawFrame(c,now,90,y+40,w,h)')
s=s.replace('c.drawImage(now,350,y+30,w*4,h*4)','B.drawFrame(c,now,350,y+30,w*4,h*4)')
s=s.replace('c.drawImage(B.sprite(a.kind,v,a.state,a.frame,a.box),550+j*175,y+30,w*4,h*4)','B.drawFrame(c,B.sprite(a.kind,v,a.state,a.frame,a.box),550+j*175,y+30,w*4,h*4)')
p.write_text(s,encoding='utf-8')
p=root/'qa.cjs';s=p.read_text(encoding='utf-8');s=s.replace('cv.width=1200','cv.width=1400');s=s.replace('c.drawImage(s,140+f*85,75+row*115,85,50)','B.drawFrame(c,s,140+f*100,75+row*115,68,40)');s=s.replace('c.drawImage(s,15+blink*50,106+row*115,40,50)','B.drawFrame(c,s,15+blink*50,106+row*115,32,40)');p.write_text(s,encoding='utf-8')
