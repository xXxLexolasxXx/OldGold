/* OldGold court: raster body + semantic arm/leg textures on the native pose rig.
 * No AI/state/registry changes. Half-world-pixel output, crisp alpha. */
'use strict';
(()=>{
 if(window.FantasyDarkCourtPolish)return;
 class PixelCache extends Map{
 constructor(){super();this.bytes=0;this.maxBytes=32*1024*1024;this.maxEntries=1200;this.hits=0;this.misses=0;}
 cost(v){return v.cv.width*v.cv.height*4;}
 delete(k){const v=super.get(k);if(v)this.bytes-=this.cost(v);return super.delete(k);}
 clear(){super.clear();this.bytes=0;}
 set(k,v){if(this.has(k))this.delete(k);const bytes=this.cost(v);while(this.size&&(this.size>=this.maxEntries||this.bytes+bytes>this.maxBytes))this.delete(this.keys().next().value);super.set(k,v);this.bytes+=bytes;return this;}
 }
 const original=foePxFrame,cache=new PixelCache(),kinds=Object.keys(FPX_BOX).filter(k=>k!=='fRaven');
 const specs={
  fThrall:{cell:0,w:19,h:43,hip:.65,leg:[.34,.77],legw:.28},
  fKnight:{cell:1,w:29,h:58,hip:.65,leg:[.40,.76],legw:.29},
  fMalgor1:{cell:2,w:36,h:84,robe:true},fMalgor3:{cell:3,w:36,h:84,robe:true},
  fBone:{cell:4,w:12,h:26,hip:.62,leg:[.25,.77],legw:.34},
  fRock:{cell:5,w:30,h:34,rock:true},
  fG_fire:{cell:6,w:30,h:55,hip:.64,leg:[.30,.74],legw:.3},
  fG_ice:{cell:7,w:25,h:55,hip:.65,leg:[.38,.75],legw:.29},
  fG_bone:{cell:8,w:29,h:55,hip:.65,leg:[.32,.77],legw:.3},
  fG_shadow:{cell:9,w:29,h:55,robe:true},
  fG_golem:{cell:10,w:44,h:82,hip:.67,leg:[.28,.75],legw:.37}
 };
 const assets={bodies:'assets/fantasy/court-bodies-v4-pixel.png',arms:'assets/fantasy/court-arms-v4-pixel.png',errors:[],parts:{},views:{},viewSources:{S:'assets/fantasy/court-bodies-v5-S.png',E:'assets/fantasy/court-bodies-v5-E.png',NE:'assets/fantasy/court-bodies-v5-NE.png',N:'assets/fantasy/court-bodies-v5-N.png'},ready:false};
 let activeView='SE';
 const partsFor=k=>assets.views[activeView]?.[k]||assets.parts[k],specFor=k=>partsFor(k).spec||specs[k];
 const canvas=(w,h)=>{const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(w));cv.height=Math.max(1,Math.round(h));return cv;};
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 function load(src){return new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{assets.errors.push(src);resolve(null);};im.src=src;});}
 function cleaned(im,cell){
  const cw=im.width/6,ch=im.height/2,cv=canvas(cw,ch),c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(im,cell%6*cw,Math.floor(cell/6)*ch,cw,ch,0,0,cw,ch);
  const id=c.getImageData(0,0,cw,ch),d=id.data,mask=new Uint8Array(cw*ch),labels=new Int32Array(cw*ch),queue=new Int32Array(cw*ch);let label=0,best=0,bestN=0;
  const matte=d[3]>16&&Math.min(d[0],d[1],d[2])>220;
  for(let i=0;i<mask.length;i++){const j=i*4,white=Math.min(d[j],d[j+1],d[j+2])>225&&Math.max(d[j],d[j+1],d[j+2])-Math.min(d[j],d[j+1],d[j+2])<20;mask[i]=d[j+3]>=235&&!(matte&&white)?1:0;}
  for(let start=0;start<mask.length;start++){if(!mask[start]||labels[start])continue;label++;let head=0,tail=1;queue[0]=start;labels[start]=label;while(head<tail){const i=queue[head++],x=i%cw,y=Math.floor(i/cw);for(let yy=Math.max(0,y-1);yy<=Math.min(ch-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(cw-1,x+1);xx++){const j=yy*cw+xx;if(mask[j]&&!labels[j]){labels[j]=label;queue[tail++]=j;}}}if(tail>bestN){bestN=tail;best=label;}}
  let x0=cw,y0=ch,x1=0,y1=0;for(let i=0;i<mask.length;i++){if(labels[i]!==best){d[i*4+3]=0;continue;}d[i*4+3]=255;const x=i%cw,y=Math.floor(i/cw);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}c.putImageData(id,0,0);
  const out=canvas(x1-x0+1,y1-y0+1);out.getContext('2d').drawImage(cv,x0,y0,out.width,out.height,0,0,out.width,out.height);return out;
 }
 function crop(cv,x,y,w,h){const out=canvas(w,h),c=out.getContext('2d');c.drawImage(cv,x,y,w,h,0,0,out.width,out.height);const d=c.getImageData(0,0,out.width,out.height).data;let x0=out.width,y0=out.height,x1=-1,y1=-1;for(let yy=0;yy<out.height;yy++)for(let xx=0;xx<out.width;xx++)if(d[(yy*out.width+xx)*4+3]>=128){x0=Math.min(x0,xx);x1=Math.max(x1,xx);y0=Math.min(y0,yy);y1=Math.max(y1,yy);}if(x1<0)return out;const tight=canvas(x1-x0+1,y1-y0+1);tight.getContext('2d').drawImage(out,x0,y0,tight.width,tight.height,0,0,tight.width,tight.height);return tight;}
 function quantize(cv){const c=cv.getContext('2d'),im=c.getImageData(0,0,cv.width,cv.height),d=im.data;for(let i=0;i<d.length;i+=4){d[i+3]=d[i+3]>=128?255:0;if(d[i+3])for(let k=0;k<3;k++)d[i+k]=Math.min(255,Math.round(d[i+k]/8)*8);}c.putImageData(im,0,0);}
 function build(body,arms,view){const table={};for(const [kind,base]of Object.entries(specs)){const S={...base,w:base.w*(view==='E'?.65:view==='NE'?.94:1)};
  const raw=cleaned(body,S.cell),arm=cleaned(arms,S.cell),B=FPX_BOX[kind],master=canvas(B[0]*2,B[1]*2),c=master.getContext('2d');c.imageSmoothingEnabled=false;
  if(S.hip){const z=(B[4]||1)/3,hip=(kind==='fG_golem'?-64:kind==='fBone'?-26:-46)*z,cut=S.hip*raw.height,x=Math.round((B[2]-S.w/2)*2);S.cut=hip;c.drawImage(raw,0,0,raw.width,cut,x,Math.round((B[3]-S.h)*2),Math.round(S.w*2),Math.round((S.h+hip)*2));c.drawImage(raw,0,cut,raw.width,raw.height-cut,x,Math.round((B[3]+hip)*2),Math.round(S.w*2),Math.round(-hip*2));}else c.drawImage(raw,Math.round((B[2]-S.w/2)*2),Math.round((B[3]-S.h)*2),Math.round(S.w*2),Math.round(S.h*2));quantize(master);
  const P={spec:S,master,raw,upper:crop(arm,0,0,arm.width,arm.height*.49),lower:crop(arm,0,arm.height*.45,arm.width,arm.height*.4),hand:crop(arm,0,arm.height*.86,arm.width,arm.height*.14),legs:[]};
  if(view==='N'&&kind==='fRock')P.upper=P.lower;if(S.hip){for(const cx of S.leg){const x=clamp(cx-S.legw/2)*raw.width,w=Math.min(S.legw*raw.width,raw.width-x),y=S.hip*raw.height,split=(S.hip+.18)*raw.height;P.legs.push({upper:crop(raw,x,y,w,split-y),lower:crop(raw,x,split,w,raw.height-split)});}}
  table[kind]=P;
 }assets.views[view]=table;if(view==='SE')assets.parts=table;}
 const anchorContext=canvas(1,1).getContext('2d');
 const ready=Promise.all([load(assets.bodies),load(assets.arms),...Object.values(assets.viewSources).map(load)]).then(([b,a,...images])=>{if(!b||!a||images.some(x=>!x))return;build(b,a,'SE');Object.keys(assets.viewSources).forEach((v,i)=>build(images[i],a,v));assets.ready=true;cache.clear();});
 function mix(a,b,t){const o={};for(const k of Object.keys(a))o[k]=typeof a[k]==='number'&&typeof b[k]==='number'?a[k]+(b[k]-a[k])*t:t>.5?b[k]:a[k];return o;}
 function pose(fr){const n=+fr.slice(1)||0;
  if(fr[0]==='a'){const keys=[[0,'i0'],[.22,'windup'],[.30,'strike'],[.44,'recover'],[.56,'i0']],u=(n+.5)/12*.56;let i=0;while(i<3&&u>keys[i+1][0])i++;let t=clamp((u-keys[i][0])/(keys[i+1][0]-keys[i][0]));t=t*t*(3-2*t);return mix(fpxPose(keys[i][1]),fpxPose(keys[i+1][1]),t);}
  if(fr[0]==='h'){const t=[.7,1,.85,.6,.32,.1][Math.min(5,n)];return mix(fpxPose('i0'),fpxPose('hurt'),t);}
  const Q=fpxPose(fr);if(fr[0]==='w'){const a=n/12*Math.PI*2;Object.assign(Q,{t:n/12,sw:Math.sin(a),lfN:Math.max(0,Math.cos(a))*5,lfF:Math.max(0,-Math.cos(a))*5,bob:-(1-Math.abs(Math.sin(a)))*2,ha:1.2+Math.sin(a)*.15,fa:1.75-Math.sin(a)*.35});}
  if(fr[0]==='i'){Q.t=n/12;Q.br=Math.sin(n/12*Math.PI*2);Q.fa=1.75+Q.br*.05;Q.blink=n===9;}
  if(fr[0]==='c'){Q.t=n/12;Q.cast=(n+1)/12;Q.open=.55+(n&1)*.2;}
  return Q;
 }
 function segment(c,im,a,b,width,flip=false){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);c.save();c.translate(a[0],a[1]);c.rotate(Math.atan2(dy,dx)-Math.PI/2);if(flip)c.scale(-1,1);c.drawImage(im,-width/2,-.4,width,len+.8);c.restore();}
 function body(c,kind,Q){const S=specFor(kind),B=FPX_BOX[kind],P=partsFor(kind),src=P.master,cut=S.hip?S.cut:null;
  for(let y=0;y<src.height;y++){const wy=(y+.5)/2-B[3],u=clamp((wy+S.h)/S.h),sway=S.robe?Math.sin(Q.t*Math.PI*2+u*3)*u*u*.8:S.rock?Math.sin(Q.t*Math.PI*2+.7)*.35:0,dx=Q.lean*(B[4]||1)/3*(1-u*.6)+sway,dy=(Q.bob+Q.br*.8)*(B[4]||1)/3;
   if(cut!==null&&wy>=cut){if(kind==='fBone'||kind==='fG_golem'||kind==='fRock')continue;const mid=B[2]*2,half=S.w*.29*2;c.drawImage(src,0,y,Math.max(0,mid-half),1,Math.round(dx*2),y+Math.round(dy*2),Math.max(0,mid-half),1);const x=mid+half;c.drawImage(src,x,y,Math.max(0,src.width-x),1,x+Math.round(dx*2),y+Math.round(dy*2),Math.max(0,src.width-x),1);continue;}
   c.drawImage(src,0,y,src.width,1,Math.round(dx*2),y+Math.round(dy*2),src.width,1);
  }
 }
 function legs(c,kind,Q){const S=specFor(kind),parts=partsFor(kind),z=(FPX_BOX[kind][4]||1)/3;if(!S.hip)return;
  for(let i=0;i<2;i++){const s=i?1:-1;let a,b,f,width;
   if(kind==='fG_golem'){const hip=-64+Q.bob,ux=Q.lean*1.8,lf=s<0?Q.lfF:Q.lfN;a=[(s*20+ux*.3)*z,hip*z];f=[(s*18+s*Q.sw*12)*z,(-9-lf)*z];b=[(a[0]+f[0])/2,(a[1]+f[1])/2];width=12;}
   else if(kind==='fBone'){const hip=-26+Q.bob*.5,ux=Q.lean*.6,lf=s<0?Q.lfF:Q.lfN;a=[(s*3+ux*.2)*z,hip*z];f=[(s*2+s*Q.sw*7)*z,-lf*.6*z];b=[(a[0]+f[0])/2+2.5*z,(a[1]+f[1])/2];width=2.3;}
   else{const bk=FPX_WAR[kind]?.bulk||1,hip=-46+Q.bob*.6,lf=s<0?Q.lfF:Q.lfN;a=[(s*6*bk+Q.lean*.25)*z,hip*z];f=[(s*3+s*Q.sw*12)*z,-lf*z];b=[(a[0]+f[0])/2+4*z,(a[1]+f[1])/2-2*z+lf*.3*z];width=5.7*bk*z*3;}
   if(activeView==='E'){a[0]*=.25;b[0]=b[0]*.8;f[0]=f[0]*.9;width*=.78;}else if(activeView==='S'||activeView==='N'){const sign=activeView==='S'?1:-1;a[0]=s*S.w*.11;b[0]=s*S.w*.13+(b[0]-a[0])*.12;f[0]=s*S.w*.14+Q.sw*s*.45;f[1]+=sign*Q.sw*s*1.1;width*=.86;}const p=parts.legs[i];segment(c,p.upper,a,b,width*.8,s<0);segment(c,p.lower,b,[f[0]+.8,f[1]],width,s<0);
  }
 }
 function rig(kind,Q,s){const z=(FPX_BOX[kind][4]||1)/3;
  if(kind.startsWith('fMalgor')){const hov=Q.br*2,sh=-142+hov,cast=Q.st==='cast',h=s<0?(cast?[-44,-206]:[-38,-84+hov]):[32,-112+(cast?-12:0)+hov],a=[s*24,sh+8],b=[(a[0]+h[0])/2-4,(a[1]+h[1])/2+4];return{a:a.map(v=>v/3),b:b.map(v=>v/3),h:h.map(v=>v/3),w:s<0?6.6:7.2,angle:0};}
  if(kind==='fG_golem'){const ux=Q.lean*1.8,uy=Q.bob*1.4+Q.br*1.5,cast=Q.st==='cast',ang=s<0?(Q.st==='strike'?2:Q.st==='windup'?.9:cast?-1.9:1.62+Q.sw*.25):(Q.st==='strike'?.3:Q.st==='windup'?-2.4:Q.st==='hurt'?2:cast?-1.45:1.45-Q.sw*.25),a=[s*44+ux,-136+uy],b=[a[0]+Math.cos(ang)*34-6,a[1]+Math.sin(ang)*34],h=[b[0]+Math.cos(ang-.12*s)*38,b[1]+Math.sin(ang-.12*s)*38];return{a:a.map(v=>v/3),b:b.map(v=>v/3),h:h.map(v=>v/3),w:14,angle:ang};}
  if(kind==='fRock'){const a=[s*9,-21],b=[s*(12+Q.sw),-14-Q.cast*5],h=[s*(13+Q.sw),-7-Q.cast*10];return{a,b,h,w:7,angle:1.5};}
  if(kind==='fBone'){const ux=Q.lean*.6,uy=Q.bob*.6+Q.br*.5,ang=s<0?Q.fa:Q.ha,a=[s*5+ux,-42+uy],b=[a[0]+Math.cos(ang)*9+(s<0?-2:-1),a[1]+Math.sin(ang)*9+(s<0?0:1.5)],h=[b[0]+Math.cos(ang-(s<0?.2:.15))*9,b[1]+Math.sin(ang-(s<0?.2:.15))*9];return{a:a.map(v=>v*z),b:b.map(v=>v*z),h:h.map(v=>v*z),w:1.5,angle:Q.wa};}
  const bk=FPX_WAR[kind]?.bulk||1,ang=s<0?Q.fa:Q.ha,a=[s*15*bk+Q.lean,-83+Q.bob+Q.br*.8],len=(s<0?30:29)*bk,h=[a[0]+Math.cos(ang)*len,a[1]+Math.sin(ang)*len];let nx=-(h[1]-a[1]),ny=h[0]-a[0],l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;if(ny<0||Math.abs(ny)<.2&&nx>0){nx=-nx;ny=-ny;}const b=[(a[0]+h[0])/2+nx*5,(a[1]+h[1])/2+ny*5];return{a:a.map(v=>v*z),b:b.map(v=>v*z),h:h.map(v=>v*z),w:4.3*bk*(kind==='fG_bone'?1.4:1),angle:Q.wa};
 }
 function arm(c,kind,Q,s,capOnly=false){const R=rig(kind,Q,s),A=partsFor(kind),S=specFor(kind),t=kind==='fMalgor3'?.42:kind==='fMalgor1'?.30:kind==='fBone'?.25:kind==='fG_golem'?.31:.35;
  // Texture sockets belong to the new silhouette. Retarget the upper arm to
  // those sockets while preserving the native animated hand coordinates.
  const sy=S.hip?-S.h+(S.h+S.cut)*t/S.hip:-S.h*(1-t),a=[(activeView==='E'?-S.w*.12+(s<0?.6:0):s*S.w*.30)+Q.lean*(FPX_BOX[kind][4]||1)/3,sy+(Q.bob+Q.br*.8)*(FPX_BOX[kind][4]||1)/3],b=[R.b[0]+(a[0]-R.a[0])*.5,R.b[1]+(a[1]-R.a[1])*.5];R.a=a;R.b=b;if(activeView==='E')R.w*=.83;else if(activeView==='S'||activeView==='N'){const sign=activeView==='S'?1:-1,dx=R.h[0]-R.a[0];R.b=[(R.a[0]+R.h[0])*.5,(R.a[1]+R.h[1])*.5+1];R.angle=sign*Math.PI/2+R.angle*.22;}else if(activeView==='NE'){R.b[1]-=.7;}
  if(capOnly){c.save();c.translate(...a);if(s<0)c.scale(-1,1);c.drawImage(A.upper,0,0,A.upper.width,A.upper.height*.22,-R.w*.45,-R.w*.32,R.w*.9,R.w*.8);c.restore();return R;}
  segment(c,A.upper,R.a,R.b,R.w,s<0);segment(c,A.lower,R.b,R.h,R.w*.9,s<0);c.save();c.translate(...R.h);c.rotate(Math.atan2(R.h[1]-R.b[1],R.h[0]-R.b[0])-Math.PI/2);if(s<0)c.scale(-1,1);c.drawImage(A.hand,-R.w*.52,-R.w*.12,R.w*1.05,R.w*(kind==='fG_golem'?.9:1.1));c.restore();return R;}
 function weapon(c,kind,Q,R){const P=(p,col)=>{c.fillStyle=col;c.beginPath();p.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](x,y));c.closePath();c.fill();},L=(x,y,xx,yy,w,col)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();};
  if(kind.startsWith('fMalgor')){const cast=Q.st==='cast',top=-84+(cast?-1:0)+Q.br*.33,at=y=>R.h[0]-(y-R.h[1])*.08,x=at(top);
   L(at(-2),-2,at(top+3),top+3,2.7,'#382b2b');L(at(-2)-.25,-2,at(top+3)-.25,top+3,1.7,'#8f593d');L(at(-4)-.65,-4,at(top+4)-.65,top+4,.45,'#cc9c65');for(let i=0;i<7;i++){const y=-15-i*9;L(at(y)-.9,y,at(y)+.8,y-1.5,.65,'#d4bb86');}
   P([[x-3.2,top],[x,top-5],[x+3.3,top],[x,top+4]],'#624684');P([[x-2.4,top],[x,top-4],[x,top+2.5]],'#c3a0e4');P([[x+.2,top-3.5],[x+2.6,top],[x,top+3]],'#9365c2');L(x-1.1,top-1.8,x-.5,top+.6,.5,'#f0d8f4');for(const s of[-1,1]){L(x+s*3,top+3,x+s*4,top-2,.8,'#997643');L(x+s*4,top-2,x+s*2,top-4,.6,'#d5b26b');}return;}
  if(kind==='fG_golem'||kind==='fRock')return;
  c.save();c.translate(...R.h);c.rotate(R.angle);
  const metal=kind==='fG_ice'?'#a4d8df':'#939b9b',edge=kind==='fG_ice'?'#e5f4e9':'#d9d8bc',len=kind==='fKnight'?19:kind==='fThrall'?10:kind==='fBone'?7:14;
  L(-3,0,2,0,1.4,'#8b6941');L(1,-2.4,1,2.4,.8,'#c2a16c');
  if(kind==='fG_fire'){L(0,0,9,0,1.3,'#6d5039');P([[7,-3],[11,-4],[14,0],[11,4],[7,3]],'#8c7355');for(let i=0;i<3;i++)P([[8+i*2,-2],[8+i*2+Math.sin(Q.t*6+i),-7-(i%2)*2],[10+i*2,-2]],i%2?'#f2c372':'#c87335');}
  else if(kind==='fG_bone'){L(0,0,10,0,2.2,'#c3b38e');P([[7,-3],[10,-4],[13,-2],[13,2],[10,4],[7,3]],'#ded0a7');c.fillStyle='#574b38';c.fillRect(10,-2,1,1);c.fillRect(10,1,1,1);}
  else if(kind==='fG_shadow'){L(0,0,5,0,1.2,'#8c7657');P([[4,0],[7,-4],[12,-5],[16,-2],[17,2],[14,5],[12,6],[14,2],[13,-1],[9,-2],[6,1]],'#a39bb7');L(7,-3,12,-3,.5,'#d6c8dc');}
  else{P([[1,-1.5],[len-3,-1.8],[len,0],[len-3,1.4],[1,1.3]],metal);L(2,-1,len-3,-1,.5,edge);L(3,0,len-4,0,.45,'#596772');if(kind==='fThrall'){c.fillStyle='#99734a';c.fillRect(4,-.8,1.5,1);c.fillRect(7,.3,1,1);}}
  c.restore();
 }
 function paint(cv,kind,fr){const B=FPX_BOX[kind],Q=pose(fr),c=cv.getContext('2d');c.imageSmoothingEnabled=false;
  c.save();c.scale(2,2);c.translate(B[2],B[3]);legs(c,kind,Q);if(activeView==='E'||activeView==='NE'||activeView==='N')arm(c,kind,Q,-1);if(activeView==='N'){const backHand=rig(kind,Q,1);backHand.angle=-Math.PI/2+backHand.angle*.22;weapon(c,kind,Q,backHand);}c.restore();body(c,kind,Q);
  c.save();c.scale(2,2);c.translate(B[2],B[3]);if(activeView==='S'||activeView==='SE')arm(c,kind,Q,-1);const R=arm(c,kind,Q,1);if(activeView!=='N')weapon(c,kind,Q,R);
  if(Q.cast){const h=rig(kind,Q,-1).h;for(let i=0;i<6;i++){const a=Q.t*Math.PI*2+i*Math.PI/3,r=2+Q.cast*3;c.fillStyle=kind==='fG_fire'?'#efc17a':kind==='fG_ice'?'#c9e8dd':kind==='fG_golem'?'#d6b5df':'#b9d790';c.fillRect(Math.round((h[0]+Math.cos(a)*r)*2)/2,Math.round((h[1]+Math.sin(a)*r)*2)/2,.5,.5);}}
  c.restore();quantize(cv);if(Q.hurt){const d=c.getImageData(0,0,cv.width,cv.height);for(let i=0;i<d.data.length;i+=4)if(d.data[i+3])for(let k=0;k<3;k++)d.data[i+k]=Math.round(d.data[i+k]+(240-d.data[i+k])*Q.hurt*.35);c.putImageData(d,0,0);}cv.fine=2;
 }

 let activeBossFrame=null,renderView='SE',mirrorCorrection=false;
 const headings=['S','SE','E','NE','N','NE','E','SE'],headings8=['S','SE','E','NE','N','NW','W','SW'],facing=new WeakMap(),previewViews=new WeakMap();
 function headingOf(N){
  const forced=previewViews.get(N);if(forced!==undefined)return{heading:forced,direction:headings8[forced],view:headings[forced],mirror:forced>=5};
  const time=Game.time;let r=facing.get(N),target=typeof foeUnit==='function'&&N.tg?foeUnit(N.tg):null,dx=0,dy=0;
  if(target&&(N.st==='atk'||N.st==='cast'||N.st==='idle')){dx=target.x-N.x;dy=target.y-N.y;}
  else if(r){dx=N.x-r.x;dy=N.y-r.y;}
  let desired=r?r.desired:(N.face<0?7:1);
  if(Math.hypot(dx,dy)>.001)desired=((Math.round(Math.atan2(dx,dy)/(Math.PI/4))%8)+8)%8;
  else if(r&&N.face!==r.face&&N.st!=='die'&&N.st!=='vanish')desired=N.face<0?7:1;
  if(!r){r={current:desired,desired,x:N.x,y:N.y,face:N.face,time};facing.set(N,r);}
  if(N.st!=='die'&&N.st!=='vanish'){
   if(r.desired!==desired){r.desired=desired;r.time=time;}
   if(time<r.time)r.time=time;
   if(time-r.time>=.055&&r.current!==desired){const d=(desired-r.current+8)%8;r.current=(r.current+(d<=4?1:7))%8;r.time+=.055;}
  }
  if(Math.hypot(dx,dy)>.001||time!==r.seen){r.x=N.x;r.y=N.y;r.face=N.face;r.seen=time;}
  return{heading:r.current,direction:headings8[r.current],view:headings[r.current],mirror:r.current>=5};
 }
 function directionFrame(kind,fr,direction='SE',correction=false){
  if(!kinds.includes(kind)||!assets.ready)return original(kind,fr);correction=!!correction;
  const i=headings8.indexOf(direction),view=i>=0?headings[i]:'SE';const match=/^([iwach])(\d+)$/.exec(String(fr));if(match)fr=match[1]+(Number(match[2])%(match[1]==='h'?6:12));else if(!NA_FRAMES.fight.includes(fr))fr='i0';
  if(i>=5)correction=!correction;
  if(activeBossFrame!==null&&kind.startsWith('fMalgor')&&fr==='c6')fr='c'+activeBossFrame;
  const key=kind+'|'+fr+'|'+view+'|'+correction;if(cache.has(key)){cache.hits++;const s=cache.get(key);cache.delete(key);cache.set(key,s);return s;}cache.misses++;
  const B=FPX_BOX[kind];let cv=canvas(B[0]*2,B[1]*2);const previous=activeView;activeView=view;try{paint(cv,kind,fr);}finally{activeView=previous;}
  if(correction){const reflected=canvas(cv.width,cv.height),c=reflected.getContext('2d');c.imageSmoothingEnabled=false;c.translate(cv.width,0);c.scale(-1,1);c.drawImage(cv,0,0);reflected.fine=2;cv=reflected;}
  const out={cv,w:B[0],h:B[1],ax:correction?B[0]-B[2]:B[2],ay:B[3],direction,view,mirror:correction};cache.set(key,out);if(cache.size>1200)cache.delete(cache.keys().next().value);return out;
 }
 foePxFrame=function(kind,fr){return directionFrame(kind,fr,renderView,mirrorCorrection);};
 const nativeRaider=foeDrawRaider;
 foeDrawRaider=function(c,N){
  if(N.k==='raven')return nativeRaider(c,N);
  const d=headingOf(N),previous=renderView,previousMirror=mirrorCorrection;renderView=d.view;mirrorCorrection=d.mirror!==(N.face<0);
  try{return nativeRaider(c,N);}finally{renderView=previous;mirrorCorrection=previousMirror;}
 };
 if(typeof foeDrawMalgor==='function'){const bossDraw=foeDrawMalgor,casts=new WeakMap();foeDrawMalgor=function(c,N){let phase=null;if(N.castT>0){let r=casts.get(N);if(!r||N.castT>r.last+.001)r={duration:N.castT,last:N.castT};phase=Math.min(11,Math.max(0,Math.round((1-N.castT/Math.max(.001,r.duration))*11)));r.last=N.castT;casts.set(N,r);}else casts.delete(N);const previous=activeBossFrame;activeBossFrame=phase;const reflect=mirrorCorrection;if(reflect){c.save();c.scale(-1,1);mirrorCorrection=false;}try{return bossDraw(c,N);}finally{if(reflect){mirrorCorrection=true;c.restore();}activeBossFrame=previous;}};}
 window.FantasyDarkCourtPolish={version:'court-v5-eight-directions',kinds,ratio:2,originalFrame:original,paint,cache,assets,ready,rig,pose,frame:directionFrame,headingOf,headings:headings8,anchors:(kind,fr,dir='SE')=>{const before=activeView,i=headings8.indexOf(dir);activeView=i>=0?headings[i]:dir;try{const q=pose(fr),cc=anchorContext,near=arm(cc,kind,q,1,true).h,far=arm(cc,kind,q,-1,true).h;return{view:activeView,mirror:i>=5,nativeNear:rig(kind,q,1).h,nativeFar:rig(kind,q,-1).h,near,far,foot:[0,0],castFX:rig(kind,q,-1).h};}finally{activeView=before;}},portrait:(kind='fMalgor1',phase=0)=>directionFrame(kind,'i'+((Math.floor(Number(phase)||0)%12+12)%12),'S'),cacheStats:()=>({entries:cache.size,rgbaBytes:cache.bytes,maxEntries:cache.maxEntries,maxRgbaBytes:cache.maxBytes,hits:cache.hits,misses:cache.misses}),setHeading:(n,d)=>{const i=headings8.indexOf(d);if(i<0)previewViews.delete(n);else previewViews.set(n,i);}};
})();
