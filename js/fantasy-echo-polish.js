/* 0.11.99 echoes of fallen dwarves/heroes: every native outfit and tool. */
'use strict';
(() => {
 if(window.FantasyEchoPolish)return;
 const before=ecSprite,cache=new Map();
 function materialKit(c){
  const ramps=new Map();
  function ramp(col){if(ramps.has(col))return ramps.get(col);const cv=mkCanvas(1,1),g=cv.getContext('2d');g.fillStyle=col;g.fillRect(0,0,1,1);const rgb=[...g.getImageData(0,0,1,1).data].slice(0,3);const r=[-.42,-.22,0,.17,.3].map(v=>'rgb('+rgb.map(a=>Math.round(v<0?a*(1+v):a+(255-a)*v)).join(',')+')');ramps.set(col,r);return r;}
  function surf(bounds,test,cols,light){const M=c.getTransform(),I=M.inverse(),pts=[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]]].map(([x,y])=>[M.a*x+M.c*y+M.e,M.b*x+M.d*y+M.f]);const x0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[0])))),x1=Math.min(c.canvas.width,Math.ceil(Math.max(...pts.map(p=>p[0])))),y0=Math.max(0,Math.floor(Math.min(...pts.map(p=>p[1])))),y1=Math.min(c.canvas.height,Math.ceil(Math.max(...pts.map(p=>p[1]))));c.save();c.setTransform(1,0,0,1,0,0);let prev='';for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const xx=I.a*(x+.5)+I.c*(y+.5)+I.e,yy=I.b*(x+.5)+I.d*(y+.5)+I.f;if(!test(xx,yy))continue;const col=cols[Math.max(0,Math.min(cols.length-1,Math.round(light(xx,yy)*(cols.length-1))))];if(prev!==col){c.fillStyle=col;prev=col;}c.fillRect(x,y,1,1);}c.restore();}
  function ell(x,y,rx,ry,col){surf([x-rx,y-ry,x+rx,y+ry],(xx,yy)=>((xx-x)/rx)**2+((yy-y)/ry)**2<=1,ramp(col),(xx,yy)=>{const nx=(xx-x)/rx,ny=(yy-y)/ry;return .29-.28*nx-.31*ny+.31*Math.sqrt(Math.max(0,1-nx*nx-ny*ny));});}
  function polygon(p,col){const xs=p.map(v=>v[0]),ys=p.map(v=>v[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);surf([x0,y0,x1,y1],(x,y)=>{let ins=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])ins=!ins;return ins;},ramp(col),(x,y)=>.91-.56*(x-x0)/(x1-x0||1)-.26*(y-y0)/(y1-y0||1));}
  function tube(x,y,xx,yy,w,col){const dx=xx-x,dy=yy-y,l=dx*dx+dy*dy||1,rr=w/2;surf([Math.min(x,xx)-rr,Math.min(y,yy)-rr,Math.max(x,xx)+rr,Math.max(y,yy)+rr],(px,py)=>{const t=Math.max(0,Math.min(1,((px-x)*dx+(py-y)*dy)/l)),rx=px-x-t*dx,ry=py-y-t*dy;return rx*rx+ry*ry<=rr*rr;},ramp(col),(px,py)=>{const t=Math.max(0,Math.min(1,((px-x)*dx+(py-y)*dy)/l));return .55-((px-x-t*dx)*.24+(py-y-t*dy)*.33)/Math.max(.2,rr);});}
  return{ell,polygon,tube};
 }

 const kits=new WeakMap(),kit=ctx=>{if(!kits.has(ctx))kits.set(ctx,materialKit(ctx));return kits.get(ctx);};
 const ellipse=(ctx,x,y,rx,ry,col)=>kit(ctx).ell(x,y,rx,ry,col),naLimb=(ctx,x,y,xx,yy,w,col)=>kit(ctx).tube(x,y,xx,yy,w,col),poly=(ctx,pts,col,ink,width)=>kit(ctx).polygon(pts,col);
 function paint(c,V,an,f){
  const ink='#4c4651',cloth=V.hero?'#9bb7a6':'#b7a9be',shadow=V.hero?'#667f78':'#7e748a',light='#e2ddc6';
  const accent=V.acc||(/^#|^rgb/.test(V.cap||'')?V.cap:'#a78c65');
  const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);},shape=(p,col,w=.45)=>poly(c,p,col,ink,w);
  const line=(x,y,xx,yy,w,col)=>naLimb(c,x,y,xx,yy,w,col);
  const phase=f/EC_N*Math.PI*2,progress=f/(EC_N-1),hurt=[1,2,1.5,1,.5,0];
  const bob=an==='hov'?Math.sin(phase)*1.5:an==='hurt'?hurt[f]:0;
  const lean=an==='atk'?ecA([0,-1,-1,-2,1,2,2,1],f,EC_N):an==='hurt'?-hurt[f]+(f===2?1:f===3?-.5:0):0;
  const angle=an==='atk'?ecA([-.5,-1.3,-2.1,-2.5,-.5,.9,1.3,.5],f,EC_N):-.35+Math.sin(phase+1)*.12;
  if(V.wisp){
   const pulse=an==='atk'?Math.sin(progress*Math.PI)*2:Math.sin(phase);
   c.save();if(an==='in'){c.beginPath();c.rect(-EC_OX,-EC_OY,EC_W,EC_OY+1);c.clip();}c.translate(Math.cos(phase)*.6,an==='in'?(1-(f+1)/12)*20:an==='out'?-progress*4:0);
   shape([[-3,-9],[-5,-15],[-2,-21],[-1,-27-pulse],[2,-22],[5,-17],[3,-10],[0,-6]],shadow);
   shape([[-2,-12],[-3,-17],[0,-25-pulse],[3,-18],[2,-12],[0,-9]],'#d9d5aa');
   ellipse(c,-.8,-17,2.2,3.8,'#f0dfaf');rect(-2,-17,1,1,ink);rect(1,-17,1,1,ink);c.restore();return;
  }
  c.save();
  if(an==='in'){c.beginPath();c.rect(-EC_OX,-EC_OY,EC_W,EC_OY+1);c.clip();c.translate(0,(1-(f+1)/EC_N)*30);}
  if(an==='out')c.translate(0,-progress*4);
  c.translate(lean,-4+bob);
  const hero=!!V.hero,bodyH=hero?13:10,by=-4-bodyH,sw=hero?6:5,hy=by-7;
  // Separate cloak folds and a soft trailing hem, without the old neon block fill.
  if(hero){shape([[-sw-1,by+1],[sw,by+1],[sw+2,0],[3,1],[-1,-2],[-sw-3,2]],shade(accent,-.35));line(-sw,by+3,-sw-1,-1,.55,shade(accent,.2));}
  shape([[-sw,by],[sw,by],[sw+2,-3],[2,-1],[-2,-3],[-sw-2,-1]],cloth);
  ellipse(c,-1,by+bodyH*.45,sw,bodyH*.55,cloth);
  shape([[-sw,by],[-1,by],[-2,-3],[-sw-2,-1]],shadow,.3);
  for(const x of [-3,1,4])line(x,by+3,x+Math.sin(phase+x)*.35,-4,.4,light);
  rect(-sw,-7,sw*2,1.3,shade(accent,-.3));rect(-.7,-7,1.5,1.4,'#c1b08b');rect(-sw-1,-9,2.4,3,shade(accent,-.1));
  for(let i=0;i<3;i++){ellipse(c,.2,by+3+i*2.3,.4,.5,'#cbbf98');line(-sw+1,by+2+i*2,-sw+2,by+2.4+i*2,.35,shade(cloth,-.3));}
  if(hero){for(const s of[-1,1]){ellipse(c,s*(sw-.3),by+1,2.5,1.5,shade(accent,-.12));line(s*(sw-2),by,s*(sw+1),by+.8,.5,'#d4c8a3');ellipse(c,s*sw,by+1,.4,.4,light);}}
  for(let i=0;i<3;i++){
   const dx=Math.sin(phase+i*1.7)*(1+i*.35),y=-1+i*1.7;
   shape([[-4+i+dx,y-2],[3-i+dx,y-2],[1+dx,y+2],[-2+dx,y]],i%2?shadow:cloth,.25);
  }
  line(-sw-1,by+2,-sw-1.5,by+8,1.7,shadow);ellipse(c,-sw-1.5,by+8,1,1,light);
  if(V.shield){ellipse(c,-sw-3,by+7,3.3,4.2,ink);ellipse(c,-sw-3,by+7,2.7,3.6,'#b5b7a2');line(-sw-3,by+4,-sw-3,by+10,.7,accent);line(-sw-5,by+7,-sw-1,by+7,.7,accent);}
  // Beard is mist, face remains an individual dwarf rather than a blank ghost.
  ellipse(c,0,hy,4.2,4.8,'#c8c9b3');ellipse(c,-3.8,hy+.6,1,1.3,'#b2b7a4');ellipse(c,3.8,hy+.6,1,1.3,'#b2b7a4');
  for(const [x,y,rx,ry]of[[-2,hy+3,1.6,3],[.1,hy+4,1.9,4],[2,hy+3,1.5,3.4]])ellipse(c,x,y,rx,ry,light);
  line(-1.5,hy+3,-1,hy+6,.45,shadow);line(1,hy+3,.6,hy+7,.45,shadow);
  for(const x of [-1.5,2]){rect(x-.8,hy-.6,1.6,1.4,ink);rect(x-.15,hy-.25,.5,.7,V.hero?'#a8ccab':'#c6b7cd');}
  line(-2.8,hy-1.4,-.7,hy-1.1,.55,'#e0dfc9');line(1,hy-1.1,3,hy-1.5,.55,'#e0dfc9');ellipse(c,.7,hy+1.4,1.3,1,'#e1d9ba');
  shape([[0,hy+.4],[2.3,hy+.8],[2.2,hy+2],[-.2,hy+2]],'#e1d9ba',.3);
  const head=V.head||V.cap;
  if(head==='helm'){
   shape([[-4.5,hy-1],[-4,hy-5],[0,hy-7],[4,hy-4],[4.5,hy-1]],'#a1aaa1');shape([[-3,hy-4],[0,hy-6],[0,hy-2],[-3,hy-2]],light,.25);rect(-4.2,hy-2,8.4,1,shadow);
  }else if(head==='hood'){
   shape([[-4,hy+1],[-5,hy-4],[0,hy-8],[5,hy-4],[4,hy+1],[3,hy-3],[0,hy-5],[-3,hy-3]],shade(accent,-.15));
  }else if(head==='wizard'){
   shape([[-5,hy-2],[-3,hy-7],[0,hy-13],[4,hy-10],[3,hy-7],[5,hy-2]],shade(accent,-.12));rect(-5,hy-3,10,1,'#c8b18a');
   line(-2.3,hy-5,-.8,hy-10,.55,shade(accent,.3));shape([[2.2,hy-10],[3.4,hy-10],[2.5,hy-7]],shade(accent,-.4),.2);rect(-3,hy-2.9,.5,.5,light);rect(3,hy-2.9,.5,.5,light);
  }else if(head==='mitre'){
   shape([[-4,hy-2],[-4,hy-8],[-1,hy-11],[2,hy-8],[4,hy-11],[4,hy-2]],light);line(0,hy-9,0,hy-3,.65,accent);line(-2,hy-6,2,hy-6,.65,accent);
  }else if(head==='horns'||head==='antler'){
   rect(-4,hy-3,8,1.5,shade(accent,-.2));for(const s of [-1,1]){line(s*3,hy-3,s*6,hy-9,1,head==='antler'?'#a79773':light);if(head==='antler')line(s*4.5,hy-6,s*7,hy-6, .7,'#a79773');}
  }else if(head==='band')rect(-4,hy-3,8,1.5,accent);
  else if(head==='feather'){
   shape([[-4,hy-2],[-2,hy-6],[4,hy-4],[5,hy-2]],accent);shape([[2,hy-4],[4,hy-10],[6,hy-9],[4,hy-4]],light,.3);
  }else if(head==='toque'){
   shape([[-4,hy-2],[-5,hy-6],[-3,hy-8],[0,hy-7],[2,hy-9],[5,hy-6],[4,hy-2]],light);rect(-4,hy-3,8,1.1,shadow);
  }else{
   shape([[-4,hy-2],[-4,hy-5],[-1,hy-9],[3,hy-10],[5,hy-7],[3,hy-7],[4,hy-2]],accent);rect(-4,hy-3,8,1,shade(accent,-.3));line(-2,hy-6,-1,hy-8,.45,shade(accent,.25));
  }
  if(V.candle){rect(1,hy-10,1.2,2.5,light);shape([[.8,hy-10],[1.7,hy-12],[2.2,hy-10]],'#d3bf8c',.2);}
  if(V.halo){c.strokeStyle='#d5c898';c.lineWidth=.5;c.beginPath();c.ellipse(0,hy-12,5,1.3,0,0,Math.PI*2);c.stroke();}
  if(V.mask)rect(-3,hy+1,6,2,shadow);
  c.save();c.translate(sw-.4,by+2);c.rotate(angle);line(.8,0,.8,hero?6.6:5.6,1.6,cloth);ellipse(c,.8,hero?6.6:5.6,1.05,1.05,light);c.translate(1,hero?7:6);c.rotate(an==='atk'?1.2:.3-angle);c.scale(.8,.8);tool(c,V.wpn,accent);c.restore();
  c.restore();
 }
 function tool(c,name,accent){
  const ink='#574c44',wood='#aa9270',metal='#c7cfbf',shine='#ebe4c9';
  const R=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);},L=(x,y,xx,yy,w,col)=>naLimb(c,x,y,xx,yy,w,col),P=(pts,col)=>poly(c,pts,col,ink,.45);
  if(name==='fist'){ellipse(c,0,-2,2,2,shine);L(-1,-2,1,-2,.6,accent);return;}
  if(name==='bow'){c.strokeStyle=wood;c.lineWidth=1;c.beginPath();c.arc(-1,-6,6,-1.2,1.2);c.stroke();L(1,-11,1,-1,.35,shine);return;}
  if(name==='lute'){ellipse(c,0,-3,3.2,4.3,wood);ellipse(c,0,-3,1,1,ink);L(0,-5,1,-12,1.2,wood);L(0,-6,1,-12,.3,shine);return;}
  if(name==='mug'){P([[-2,-5],[2,-5],[2,0],[-2,0]],wood);c.strokeStyle=metal;c.lineWidth=.65;c.strokeRect(2,-4,2,3);R(-2,-5,4,.6,shine);return;}
  if(name==='sack'){ellipse(c,0,-3,3.4,5,wood);L(-2,-7,2,-7,.65,ink);L(-1,-7,-1,-1,.5,shine);return;}
  if(name==='whip'){L(0,1,0,-5,1.2,wood);c.strokeStyle=wood;c.lineWidth=.65;c.beginPath();c.moveTo(0,-5);c.bezierCurveTo(6,-14,10,-8,6,-3);c.stroke();return;}
  if(name==='lamp'){L(0,0,0,-5,.8,metal);P([[-2.5,-5],[2.5,-5],[2,-10],[-2,-10]],metal);R(-1.5,-9,3,3,'#d7d5a7');R(-.6,-8.5,.7,2.3,shine);return;}
  L(0,1,0,-12,1.2,wood);L(-.25,0,-.25,-11,.35,shine);
  if(name==='sword'||name==='dagger'){const h=name==='dagger'?7:13;P([[-.8,-1],[-1,-h],[0,-h-2],[1,-h],[.8,-1]],metal);L(-2,-1,2,-1,.8,accent);L(-.35,-3,-.35,-h,.4,shine);}
  else if(name==='axe'||name==='cleaver'){P([[0,-12],[4,-13],[5,-10],[4,-7],[0,-8]],metal);L(1,-11,4,-11,.5,shine);}
  else if(name==='hammer'){P([[-3,-13],[3,-13],[3,-9],[-3,-9]],metal);R(-2,-12,4,.6,shine);}
  else if(name==='pick'){P([[-5,-11],[0,-13],[5,-11],[6,-9],[0,-11],[-5,-9]],metal);}
  else if(name==='scythe'){c.strokeStyle=metal;c.lineWidth=1.3;c.beginPath();c.moveTo(0,-12);c.quadraticCurveTo(6,-15,8,-10);c.stroke();}
  else if(name==='saw'){P([[-2,-12],[7,-12],[7,-10],[5,-9],[4,-10],[3,-9],[2,-10],[1,-9],[-2,-10]],metal);}
  else if(name==='tongs'){L(0,0,-2,-12,.9,metal);L(0,0,2,-12,.9,metal);}
  else if(name==='pitch'){for(const x of [-2,0,2])L(x,-8,x,-14,.7,metal);L(-2,-8,2,-8,.7,metal);}
  else if(name==='pin'){L(0,-2,0,-11,3,wood);L(-.7,-3,-.7,-10,.6,shine);}
  else if(name==='mace'){ellipse(c,0,-12,2.7,3,metal);L(-1,-13,1,-11,.6,shine);}
  else {P([[-2,-12],[0,-15],[2,-12],[0,-9]],'#b6c9b4');L(-.5,-13,0,-11,.5,shine);}
 }
 ecSprite=function(V,an,f){
  const key=[V.key,an,f].join('|');if(cache.has(key))return cache.get(key);
  const cv=mkCanvas(EC_W*2,EC_H*2),c=cv.getContext('2d');c.scale(2,2);c.lineJoin='round';c.lineCap='round';c.imageSmoothingEnabled=false;c.translate(EC_OX,EC_OY);paint(c,V,an,f);
  if(an==='out'){
   const image=c.getImageData(0,0,cv.width,cv.height),p=f/(EC_N-1);
   for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++){const i=(y*cv.width+x)*4;if(image.data[i+3]&&naHash(x>>1,y>>1)<p*.9)image.data[i+3]=0;}c.putImageData(image,0,0);
  }
  if(an==='hurt'){c.save();c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-atop';c.fillStyle='rgba(248,239,210,'+[.5,.4,.3,.2,.12,.04][f]+')';c.fillRect(0,0,cv.width,cv.height);c.restore();}
  cv.fine=2;cache.set(key,cv);if(cache.size>EC_CACHE_MAX)cache.delete(cache.keys().next().value);return cv;
 };
 window.FantasyEchoPolish={before,paint,tool,ratio:2,cache};
})();
