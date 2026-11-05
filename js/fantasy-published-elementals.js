'use strict';
// Cosmetic-only moving elementals. Load after native night/rocks/nechist and other art.
// Native AI, damage, resource drops, grab tables and hand/victim anchors are untouched.
(() => {
 if(globalThis.FantasyPublishedElementals)return;
 const native={entSprite,makeEntFrame,drawRockEnt,drawWaterEnt,rockSprite,rockLeg,clawJaw};
 const trees=new Map(),stones=new Map(),jaws=new Map();let rockDepth=0;
 const limits={trees:[64,10*1024*1024],stones:[24,4*1024*1024],jaws:[96,4*1024*1024]};
 function keep(map,key,value,limit){
  const image=value.cv||value,ctx=image.getContext('2d'),pixels=ctx.getImageData(0,0,image.width,image.height);
  for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]>=128?255:0;ctx.putImageData(pixels,0,0);
  map.set(key,value);const cost=v=>{const a=v.cv||v;return a.width*a.height*4;};let bytes=0;for(const v of map.values())bytes+=cost(v);
  while(map.size>limit[0]||bytes>limit[1]){const first=map.keys().next().value;bytes-=cost(map.get(first));map.delete(first);}return value;
 }
 const cv=(w,h)=>{const a=document.createElement('canvas');a.width=Math.ceil(w*2);a.height=Math.ceil(h*2);const c=a.getContext('2d');c.scale(2,2);c.lineJoin='round';c.lineCap='round';return[a,c]};
 function shape(c,p,col,ink='#302a22',width=.7){c.fillStyle=col;c.beginPath();p.forEach(([x,y],i)=>(i?c.lineTo(x,y):c.moveTo(x,y)));c.closePath();c.fill();if(ink){c.strokeStyle=ink;c.lineWidth=width;c.stroke()}}
 function line(c,pts,col,w){c.strokeStyle=col;c.lineWidth=w;c.beginPath();pts.forEach(([x,y],i)=>(i?c.lineTo(x,y):c.moveTo(x,y)));c.stroke()}
 function leaf(c,x,y,s,col){shape(c,[[x-s,y],[x-s*.9,y-s*.45],[x-s*.45,y-s*.75],[x-s*.1,y-s*.9],[x+s*.55,y-s*.6],[x+s,y-s*.15],[x+s*.9,y+s*.35],[x+s*.4,y+s*.6],[x-s*.25,y+s*.6],[x-s*.8,y+s*.35]],'#293d27','#1c2c20',.7);shape(c,[[x-s*.84,y-s*.1],[x-s*.6,y-s*.52],[x-s*.1,y-s*.72],[x+s*.48,y-s*.43],[x+s*.8,y],[x+s*.4,y+s*.35],[x-s*.35,y+s*.3]],col,null);for(const[dx,dy,r]of[[-.48,-.26,.28],[-.1,-.42,.31],[.28,-.17,.25],[-.2,.05,.22],[.54,.05,.19]]){const xx=x+dx*s,yy=y+dy*s;shape(c,[[xx-r*s,yy],[xx-r*s*.5,yy-r*s*.6],[xx+r*s*.45,yy-r*s*.7],[xx+r*s,yy],[xx+r*s*.25,yy+r*s*.45],[xx-r*s*.7,yy+r*s*.4]],'#77924b',null);c.fillStyle='#a4af66';c.fillRect(xx-r*s*.5,yy-r*s*.4,Math.max(.5,r*s*.7),Math.max(.5,r*s*.28))}}
 function branch(c,pts,L,w){line(c,pts,'#30281e',w+1.8);line(c,pts,L.bark,w);line(c,pts.map(([x,y])=>[x-.7,y-.5]),L.light,Math.max(.7,w*.22));for(let n=1;n<pts.length;n++){const p=pts[n];shape(c,[[p[0]-w*.45,p[1]],[p[0]-w*.25,p[1]-2],[p[0]+w*.3,p[1]-1],[p[0]+w*.4,p[1]+1]],L.dark,null);if(w>4){shape(c,[[p[0]-w*.5,p[1]-1],[p[0]-w*.4,p[1]-w*.38],[p[0]+w*.25,p[1]-w*.35],[p[0]+w*.47,p[1]+1],[p[0]+w*.1,p[1]+w*.4],[p[0]-w*.4,p[1]+w*.27]],L.bark);line(c,[[p[0]-w*.35,p[1]],[p[0]-w*.2,p[1]-w*.2],[p[0]+w*.15,p[1]-w*.17]],L.light,.7);line(c,[[p[0]+w*.2,p[1]],[p[0],p[1]+w*.2],[p[0]-w*.2,p[1]+w*.1]],L.dark,.7)}}}
 function treeFrame(kind,name){const key=kind+'|'+name;if(trees.has(key))return trees.get(key);const L=ENT_LOOK[kind]||ENT_LOOK.oak,P=entPose(name,L),[a,c]=cv(ENT_SW,ENT_SH),cx=ENT_CX;
  // Root-haunches follow the native foot/knee coordinates on every pose.
  P.legs.forEach((p,n)=>{branch(c,p,L,9);const f=p[2];shape(c,[[f[0]-5,f[1]-3],[f[0]+3,f[1]-3],[f[0]+7,f[1]+1],[f[0]+3,f[1]+2],[f[0]-7,f[1]+1]],L.bark);line(c,[[f[0]-2,f[1]-1],[f[0]+4,f[1]]],L.light,1)});
  branch(c,P.arms[0],L,10);
  // A hollow, split-oak breastplate and twisted shoulder burls replace the old
  // straight trunk and round canopy; each species keeps its native bark palette.
  shape(c,[[cx-10,83],[cx-14,70],[cx-13,L.faceY-3],[cx-8,L.faceY-12],[cx+2,L.faceY-14],[cx+12,L.faceY-7],[cx+15,70],[cx+10,85],[cx+3,89],[cx-3,84]],L.dark);
  shape(c,[[cx-9,81],[cx-11,67],[cx-10,L.faceY-3],[cx-5,L.faceY-9],[cx+2,L.faceY-10],[cx+4,85],[cx-2,80]],L.bark);
  shape(c,[[cx+3,L.faceY-10],[cx+10,L.faceY-5],[cx+12,70],[cx+8,83],[cx+4,85],[cx+1,70]],L.light);
  shape(c,[[cx-4,69],[cx,63],[cx+5,68],[cx+3,80],[cx-1,84],[cx-5,77]],'#241c14');
  for(let j=0;j<6;j++){const x=cx-10+j*4;line(c,[[x,L.faceY-3],[x-1,64+j%2*5],[x+1,76]],j%2?L.dark:L.light,.65)}
  for(const[x,y]of[[cx-10,L.faceY+3],[cx+8,L.faceY+10],[cx-7,77],[cx+5,81]]){shape(c,[[x-2,y-4],[x+2,y-3],[x+3,y+3],[x,y+6],[x-3,y+1]],L.bark);line(c,[[x-1,y-3],[x,y],[x-1,y+4]],L.light,.8);line(c,[[x+1,y-2],[x+2,y+2]],L.dark,1)}
  if(kind==='birch')for(let j=0;j<7;j++){const x=cx-9+j%3*7,y=L.faceY-1+j*4;c.fillStyle='#514c43';c.fillRect(x,y,4,1)}
  // Forked antlers carry small angular leaf clusters, not a static tree asset.
  for(const side of[-1,1]){const pts=[[cx+side*7,L.faceY-9],[cx+side*17,L.faceY-20],[cx+side*16,L.faceY-34],[cx+side*23,L.faceY-42]];branch(c,pts,L,5);branch(c,[pts[1],[cx+side*26,L.faceY-25],[cx+side*30,L.faceY-31]],L,3);branch(c,[pts[2],[cx+side*9,L.faceY-40]],L,2.4);for(const [x,y]of[pts[2],pts[3],[cx+side*27,L.faceY-27]])leaf(c,x,y,kind==='fir'?6:7.5,L.crown[side>0?1:0]);}
  // Dense, tiered foliage: broad leaf masses with authored light clusters.
  leaf(c,cx-17,L.faceY-30,16,L.crown[0]);leaf(c,cx+18,L.faceY-31,16,L.crown[0]);leaf(c,cx-3,L.faceY-39,17,L.crown[1]);leaf(c,cx+4,L.faceY-25,16,L.crown[0]);
  leaf(c,cx-9,76,4,L.crown[0]);leaf(c,cx+7,67,3.5,L.crown[1]);
  branch(c,P.arms[1],L,10);
  P.arms.forEach((p,n)=>{const h=p[2];if(P.noClaw&&n===1){shape(c,[[h[0]-4,h[1]-3],[h[0]+3,h[1]-4],[h[0]+5,h[1]+1],[h[0]+1,h[1]+4],[h[0]-4,h[1]+2]],L.bark);return}for(let k=0;k<3;k++){const dir=n===0?-1:1;branch(c,[[h[0],h[1]],[h[0]+dir*(3+k),h[1]+2+k*2],[h[0]+dir*(6+k),h[1]+1+k*2]],L,1.6)}});
  const eyes=[[cx-5,L.faceY+6],[cx+3,L.faceY+6]];eyes.forEach(([x,y])=>{shape(c,[[x-2,y-1],[x+3,y-2],[x+3,y+3],[x-2,y+2]],'#211b12',null);c.fillStyle='#f2c974';c.fillRect(x,y,2,1)});
  eyes.forEach(([x,y])=>{c.fillStyle='#ad6b2b';c.fillRect(x-1,y-1,4,3);c.fillStyle='#f1c361';c.fillRect(x,y,2,2);c.fillStyle='#fff0ab';c.fillRect(x,y,1,1);line(c,[[x-3,y-2],[x+3,y-3]],L.dark,1.5)});
  line(c,[[cx-5,L.faceY+13],[cx-1,L.faceY+15],[cx+4,L.faceY+13]],'#2b1f14',2);
  a.fine=2;const out={cv:a,eyes,hand:P.arms[1][2].slice()};return keep(trees,key,out,limits.trees);
 }
 entSprite=function(kind,name){return ['oak','birch','pine','fir'].includes(kind)?treeFrame(kind,name):native.entSprite(kind,name)};
 // Scoped hooks: ordinary geological rocks never pass through the new art.
 rockSprite=function(size,variant,body=false){if(!rockDepth||!body)return native.rockSprite(size,variant,body);const key=size+'|'+variant;if(stones.has(key))return stones.get(key);const S=ROCK_SIZES[size],[a,c]=cv(S.w,S.h),x=S.w/2,y=S.h-6,w=S.w*.42,h=S.h*.74;
  shape(c,[[x-w,y-1],[x-w*.92,y-h*.36],[x-w*.72,y-h*.7],[x-w*.3,y-h],[x+w*.2,y-h*1.05],[x+w*.6,y-h*.88],[x+w*.94,y-h*.53],[x+w,y-1],[x+w*.44,y+3],[x-w*.5,y+4]],'#5b5347','#38352d',1.2);
  const lumps=[[-.57,-.28,.63,.55],[-.35,-.66,.65,.55],[.15,-.83,.65,.48],[.57,-.5,.6,.6],[.42,-.08,.72,.48],[-.18,-.08,.75,.48]];
  for(let n=0;n<lumps.length;n++){const [px,py,rx,ry]=lumps[n],xx=x+px*w,yy=y+py*h;shape(c,[[xx-rx*w*.48,yy],[xx-rx*w*.45,yy-ry*h*.36],[xx-rx*w*.15,yy-ry*h*.6],[xx+rx*w*.2,yy-ry*h*.55],[xx+rx*w*.48,yy-ry*h*.2],[xx+rx*w*.5,yy+ry*h*.15],[xx+rx*w*.22,yy+ry*h*.35],[xx-rx*w*.17,yy+ry*h*.35]],['#9e927b','#a99d84','#b9ac90','#938974','#a2957e','#8b806b'][n]);shape(c,[[xx-rx*w*.4,yy-ry*h*.24],[xx-rx*w*.1,yy-ry*h*.5],[xx+rx*w*.2,yy-ry*h*.44],[xx+rx*w*.35,yy-ry*h*.2],[xx,yy-ry*h*.08]],'#c5b698',null);shape(c,[[xx+rx*w*.35,yy-ry*h*.1],[xx+rx*w*.4,yy+ry*h*.12],[xx+rx*w*.12,yy+ry*h*.3],[xx-rx*w*.1,yy+ry*h*.23]],'#746958',null);line(c,[[xx-rx*w*.23,yy],[xx-rx*w*.1,yy+ry*h*.1],[xx+rx*w*.05,yy-ry*h*.02]],'#625947',.55);for(const[dx,dy]of[[-.23,-.2],[.08,-.32],[.25,-.04]]){c.fillStyle='#ddd0b0';c.fillRect(xx+dx*rx*w,yy+dy*ry*h,1.2,.7)}}
  for(const[dx,dy,r]of[[-.1,-.92,.2],[.4,-.82,.17]]){const xx=x+dx*w,yy=y+dy*h;shape(c,[[xx-r*w,yy],[xx-r*w*.8,yy-r*h*.6],[xx-r*w*.25,yy-r*h],[xx+r*w*.5,yy-r*h*.7],[xx+r*w,yy],[xx+r*w*.5,yy+r*h*.3]],'#9e957f');line(c,[[xx-r*w*.6,yy-r*h*.4],[xx+r*w*.3,yy-r*h*.65]],'#d5c5a3',.8)}
  for(let j=0;j<5;j++){const xx=x-w*.72+j*w*.33,yy=y-h*.17-(j%2)*h*.25;shape(c,[[xx-2,yy],[xx-3,yy-2],[xx,yy-3],[xx+3,yy-1],[xx+1,yy+2]],'#657347',null);c.fillStyle='#929a5e';c.fillRect(xx-2,yy-2,2,1);c.fillRect(xx+1,yy,1.5,1)}
  return keep(stones,key,a,limits.stones);
 };
 rockLeg=function(c,ax,ay,kx,ky,fx,fy,dim=0,moss=0){if(!rockDepth)return native.rockLeg(c,ax,ay,kx,ky,fx,fy,dim,moss);const pts=[[ax,ay],[kx,ky],[fx,fy]];for(let j=0;j<2;j++){const[a,b]=[pts[j],pts[j+1]],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;const p=(t,w)=>[a[0]+dx*t+nx*w,a[1]+dy*t+ny*w];shape(c,[p(0,-3.2),p(.3,-4),p(.65,-3),p(1,-2.6),p(1,2.8),p(.6,3.8),p(.2,3.2)],dim>.3?'#766d5a':'#a0947b','#403a30',.8);shape(c,[p(.05,-2.7),p(.32,-3.2),p(.62,-2.3),p(.8,-1),p(.45,-.7),p(.17,-1)],dim>.3?'#9a8f75':'#ccbb96',null);line(c,[p(.4,-1),p(.55,.7),p(.7,.3)],'#655b48',.7)}for(const[x,y]of[[kx,ky],[fx,fy]]){shape(c,[[x-4,y],[x-3,y-3],[x-1,y-4],[x+3,y-2],[x+4,y+1],[x+1,y+3],[x-3,y+2]],'#9e9075');line(c,[[x-2,y-2],[x,y-3],[x+2,y-2]],'#d3c3a2',.9);line(c,[[x+1,y],[x+2,y+1],[x,y+2]],'#665c49',.7)}if(moss){shape(c,[[kx-3,ky],[kx-4,ky-2],[kx-1,ky-3],[kx+2,ky-2],[kx+1,ky+1]],'#6f7b49',null);c.fillStyle='#a3a66a';c.fillRect(kx-2,ky-2,2,.8)}};
 clawJaw=function(size,variant,k,up){if(!rockDepth)return native.clawJaw(size,variant,k,up);const original=native.clawJaw(size,variant,k,up),key=[size,variant,k,up].join('|');if(jaws.has(key))return jaws.get(key);const[a,c]=cv(original.W,original.H),W=original.W,H=original.H,cy=H/2;
  const pts=up?[[W*.12,cy],[W*.2,cy-H*.32],[W*.62,cy-H*.38],[W*.95,cy-H*.08],[W*.7,cy],[W*.5,cy-1],[W*.35,cy+1]]:[[W*.12,cy],[W*.35,cy-1],[W*.5,cy+1],[W*.72,cy],[W*.94,cy+H*.09],[W*.63,cy+H*.35],[W*.2,cy+H*.26]];
  shape(c,pts,up?'#aa9b7c':'#8b7d62');line(c,[[W*.2,up?cy-H*.2:cy+H*.16],[W*.43,up?cy-H*.29:cy+H*.22],[W*.66,up?cy-H*.28:cy+H*.2]],'#d5c5a2',1.1);line(c,[[W*.35,up?cy-H*.2:cy+H*.13],[W*.43,up?cy-H*.09:cy+H*.26],[W*.57,up?cy-H*.16:cy+H*.2]],'#665a46',.7);for(let j=0;j<4;j++){c.fillStyle='#c1af88';c.fillRect(W*(.25+j*.12),up?cy-H*(.12+j%2*.08):cy+H*(.08+j%2*.08),1.3,.7)}const out={...original,cv:a};return keep(jaws,key,out,limits.jaws);
 };
 drawRockEnt=function(c,e){const awake=e.k>.02;if(awake)rockDepth++;try{return native.drawRockEnt(c,e)}finally{if(awake)rockDepth--}};
 // Water is now a layered tidal vortex with a broad breaking-wave mantle,
 // translucent hollow core and braided stream arms. Native H/40 collapse,
 // phase/attack timing and WATER_ARM grab endpoint remain identical.
 function waterLocal(e){const[a,c]=cv(110,82);c.translate(55,67);const t=Game.time,rage=['fight','smash','drag'].includes(e.state),speed=rage?5.5:e.moving?4.4:2.6,atk=e.atk?t-e.atk:9,swing=e.moving?Math.sin(e.phase*.9):Math.sin(t*1.6+e.i)*.4;
  let fh=[19,-8+swing*3],bh=[-19,-9-swing*3];if(e.moving){fh=[17+swing*5,-10+swing*4];bh=[-17-swing*5,-10-swing*4]}
  if(['fight','smash'].includes(e.state)){if(atk<.35){fh=[9,-50];bh=[-12,-40]}else if(atk<.8){fh=[24,-2];bh=[-14,-16]}else{fh=[20,-22+Math.sin(t*speed)*3];bh=[-17,-14+Math.sin(t*speed+2)*3]}}
  if(e.state==='drag')fh=waterGrabHand(e);
  const arm=(sx,sy,h,back)=>{const ex=(sx+h[0])/2+(back?-5:5),ey=(sy+h[1])/2+4;line(c,[[sx,sy],[ex,ey],h],'#254c59',9);line(c,[[sx-1,sy],[ex-1,ey-1],[h[0]-1,h[1]]],back?'#429b9f':'#78c4bd',6);line(c,[[sx-2,sy-1],[ex-2,ey-2],[h[0]-1,h[1]-1]],'#c9ebe0',1.2);shape(c,[[h[0]-3,h[1]-2],[h[0]+2,h[1]-3],[h[0]+6,h[1]],[h[0]+2,h[1]+2],[h[0]-3,h[1]+3]],'#8fd3ca');for(let j=0;j<3;j++){line(c,[[h[0]+2,h[1]-1+j],[h[0]+6+j,h[1]-3+j*2]],'#d3f2e3',1)}};
  arm(-10,-28,bh,true);
  const wave=Math.sin(t*speed)*1.3;
  const volume=c.createLinearGradient(-12,-44,15,-2);volume.addColorStop(0,'#a6d5ca');volume.addColorStop(.25,'#599da6');volume.addColorStop(.65,'#2e6479');volume.addColorStop(1,'#84bbb2');
  shape(c,[[-17,0],[-11,-11],[-15,-24],[-18,-31],[-10,-36],[-10,-43],[-3,-46],[7,-43],[13,-34],[21,-32],[16,-25],[10,-22],[10,-12],[18,-3],[13,2],[3,4],[-7,3]],volume,'#244956',1.4);
  shape(c,[[-11,-29],[-9,-41],[-3,-43],[4,-42],[9,-36],[9,-30],[4,-32],[-2,-28]],'#9bd7cc');
  shape(c,[[-12,-22],[-4,-27],[5,-25],[10,-20],[7,-16],[-1,-14],[-8,-18]],'#1d5267');
  shape(c,[[-6,-23],[-1,-25],[4,-23],[5,-20],[1,-18],[-3,-19]],'#67b1b1',null);
  // Broad crest sweeping sideways, scalloped foam replaces the old ice spikes.
  shape(c,[[-17,-30],[-22,-36],[-18,-42],[-12,-45],[-8,-50],[-2,-51],[4,-47],[10,-46],[17,-42],[22,-35],[15,-38],[12,-42],[6,-41],[0,-45],[-6,-44],[-9,-39],[-14,-37]],'#75bfb9');
  line(c,[[-20,-36],[-16,-41],[-10,-44],[-6,-48],[-1,-49],[5,-45],[11,-44],[17,-40]],'#d4ebd7',1.8);
  // Stacked foam shelves and cascading side ribbons give the wave thickness.
  for(const[xx,yy,s]of[[-17,-39,2.7],[-11,-44,3],[-5,-48,2.4],[2,-46,2.5],[9,-44,2.4],[15,-40,2.2]]){shape(c,[[xx-s,yy],[xx-s*.7,yy-s*.5],[xx,yy-s*.7],[xx+s*.8,yy-s*.2],[xx+s,yy+s*.4],[xx-s*.5,yy+s*.5]],'#a4d5cb',null);c.fillStyle='#e3f0df';c.fillRect(xx-s*.5,yy-s*.4,s,.7);c.fillStyle='#6ca9ab';c.fillRect(xx,yy+s*.3,s,.7)}
  for(const side of[-1,1]){line(c,[[side*13,-36],[side*15,-29],[side*11,-21],[side*12,-13],[side*8,-6]],'#33738a',4.8);line(c,[[side*12,-37],[side*14,-29],[side*10,-21],[side*11,-13],[side*7,-6]],'#90d1c9',2.8);line(c,[[side*11.5,-36],[side*13,-29],[side*9.5,-21]],'#e0eee1',.8);for(const[y,dx]of[[-27,0],[-20,-1],[-11,-2]]){c.fillStyle='#b4ddd1';c.fillRect(side*(13+dx),y,1.5,2)}}
  for(let j=0;j<6;j++){const y=-10+j*2.4,x=Math.sin(t*2+j*.8)*2,w=13-j*.5;shape(c,[[x-w,y],[x-w*.4,y-2],[x+w*.65,y-1],[x+w,y+1],[x+w*.3,y+3],[x-w*.6,y+2]],j%2?'#4d9caa':'#79bab6','#386e80',.5);line(c,[[x-w*.6,y-.5],[x+w*.5,y]],'#badfd0',.65)}
  const eyeY=-35;for(const x of[-3.4,5.4]){shape(c,[[x-3,eyeY-1],[x+3,eyeY-2],[x+2,eyeY+2],[x-2,eyeY+2]],'#204954',null);c.fillStyle=rage?'#fff0c1':'#d8f0bb';c.fillRect(x-1.5,eyeY,3,1.5);c.fillStyle='#3a675d';c.fillRect(x,eyeY,1,1.5)}
  for(const[x,s]of[[-3.4,-1],[5.4,1]]){shape(c,[[x-4,eyeY-2],[x-2,eyeY-5+s],[x+2,eyeY-5-s],[x+4,eyeY-2],[x+1,eyeY-3]],'#b2e0d3',null);line(c,[[x-3,eyeY-3],[x+1,eyeY-4],[x+3,eyeY-2]],'#eff3df',.65)}
  line(c,[[-4,-28],[0,-26],[6,-28]],'#204554',1.6);for(let j=0;j<3;j++){c.fillStyle='#e6efe0';c.fillRect(-2+j*3,-27,1,2)}
  arm(11,-29,fh,false);for(let j=0;j<5;j++){const q=(t*.8+j*.21)%1;c.fillStyle='#c3e4d7';c.fillRect(-13+j*6+Math.sin(t+j)*2,-51-q*8,1,2)}return a;
 }
 drawWaterEnt=function(c,e){const{bx,by,H}=waterGeom(e),k=e.k;if(k<.3)drawWaterEyes(c,e,e.alpha*(1-k/.3)*Math.min(1,nightAmt()*4));c.save();c.globalAlpha=e.alpha;c.fillStyle='rgba(36,104,119,.35)';c.beginPath();c.ellipse(bx,by,19*k+3,5.8,0,0,Math.PI*2);c.fill();c.strokeStyle='#8dbeb1';c.lineWidth=.6;for(let j=0;j<3;j++){const q=(Game.time*.9+j*.33+e.i*.1)%1;c.globalAlpha=e.alpha*(1-q)*.55;c.beginPath();c.ellipse(bx,by,9+q*17,2.6+q*4.6,0,0,Math.PI*2);c.stroke()}c.globalAlpha=e.alpha;if(k>.02&&H>1){const a=waterLocal(e);c.translate(bx,by);c.scale(e.face<0?-1:1,H/40);c.imageSmoothingEnabled=R.smooth;c.drawImage(a,-55,-67,110,82)}c.restore();if(e.state==='drag'&&(e.victim||e.vsnap))drawVictim(c,e)};
 globalThis.FantasyPublishedElementals={version:1,native,treeFrame,waterLocal,caches:{trees,stones,jaws},families:['tree','rock','water'],pixelRatio:2,cacheLimits:limits,ready:Promise.resolve(),errors:[],auditStatus:{tree:'front-only; directional redesign pending',rock:'front-only; directional redesign pending',water:'front-only default; directional prototype requires elementalPreview=1'}};
})();

// Directional prototype: the water elemental. Other two families remain legacy
// material passes until their separate authored views/rig tests are completed.
(() => {
 const owner=globalThis.FantasyPublishedElementals;if(!owner||owner.waterDirectional)return;
 if(typeof location==='undefined'||typeof URLSearchParams!=='function'||new URLSearchParams(location.search).get('elementalPreview')!=='1')return;
 owner.auditStatus.water='directional preview only; visual acceptance pending';
 const previous=drawWaterEnt,headings=new WeakMap(),cache=new Map();let gripScope=0;const nativeGrip=drawGrip;
 const D=['E','SE','S','SW','W','NW','N','NE'];
 const info=owner.waterDirectional={version:1,ready:Promise.resolve(),errors:[],views:['S','SE','E','NE','N'],directions:D.slice(),cache,maxEntries:64,maxBytes:10*1024*1024,bytes:0,previous,headings};
 const snap=v=>Math.round(v*2)/2;
 function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(snap(x),snap(y),Math.max(.5,snap(w)),Math.max(.5,snap(h)));}
 function poly(c,pts,color){c.fillStyle=color;for(let y=Math.floor(Math.min(...pts.map(p=>p[1]))*2)/2;y<Math.max(...pts.map(p=>p[1]));y+=.5){const hits=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],q=y+.25;if((a[1]<=q&&b[1]>q)||(b[1]<=q&&a[1]>q))hits.push(a[0]+(q-a[1])*(b[0]-a[0])/(b[1]-a[1]));}hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2){const x=Math.ceil(hits[i]*2)/2,z=Math.ceil(hits[i+1]*2)/2;if(z>x)c.fillRect(x,y,z-x,.5);}}}
 function line(c,pts,color,width=1){for(let k=1;k<pts.length;k++){const a=pts[k-1],b=pts[k],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2));for(let j=0;j<=n;j++)rect(c,a[0]+(b[0]-a[0])*j/n-width/2,a[1]+(b[1]-a[1])*j/n-width/2,width,width,color);}}
 function oval(c,x,y,rx,ry,color){c.fillStyle=color;for(let yy=Math.floor((y-ry)*2)/2;yy<y+ry;yy+=.5){const q=(yy+.25-y)/ry;if(Math.abs(q)>=1)continue;const r=Math.sqrt(1-q*q)*rx,a=Math.ceil((x-r)*2)/2,z=Math.floor((x+r)*2)/2;if(z>a)c.fillRect(a,yy,z-a,.5);}}
 const P={ink:'#062a51',deep:'#06447c',shade:'#086ca4',mid:'#129ed0',light:'#3ed3ee',foam:'#8feafa',crest:'#defbff',gold:'#b9a16d',goldLight:'#ddc998',weed:'#4e7566'};
 function direction(e){
   const old=headings.get(e);let dx=0,dy=0;
   if(e.moving&&old){dx=e.x-old.x;dy=e.y-old.y;}
   if(Math.hypot(dx,dy)<.002){
     if(e.state==='drag'&&e.dragDir){[dx,dy]=e.dragDir;}
     else if(e.goal){dx=e.goal[0]-e.x;dy=e.goal[1]-e.y;}
     else {const q=e.foe||e.target;if(q&&Number.isFinite(q.x)&&Number.isFinite(q.y)){dx=q.x+(q.w||0)/2-e.x;dy=q.y+(q.h||0)/2-e.y;}}
   }
   const dir=Math.hypot(dx,dy)>.02?D[(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8]:old?.dir||(e.face<0?'W':'E');
   headings.set(e,{x:e.x,y:e.y,dir});return dir;
 }
 const viewOf=dir=>({SW:'SE',W:'E',NW:'NE'})[dir]||dir;
 const atlas=new Image(),parts=[];
 info.ready=new Promise(resolve=>{atlas.onload=()=>{for(let i=0;i<5;i++){const cell=document.createElement('canvas');cell.width=Math.floor(atlas.width/5);cell.height=atlas.height;const q=cell.getContext('2d');q.drawImage(atlas,i*atlas.width/5,0,atlas.width/5,atlas.height,0,0,cell.width,cell.height);const d=q.getImageData(0,0,cell.width,cell.height);let x0=cell.width,y0=cell.height,x1=0,y1=0;for(let y=0;y<cell.height;y++)for(let x=0;x<cell.width;x++){const n=(y*cell.width+x)*4;d.data[n+3]=d.data[n+3]>=160?255:0;if(d.data[n+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}q.putImageData(d,0,0);parts.push({image:cell,x:x0,y:y0,w:x1-x0+1,h:y1-y0+1});}cache.clear();info.bytes=0;resolve();};atlas.onerror=()=>{info.errors.push('water-morphling-body-v2.png failed');resolve();};});
 atlas.src='assets/fantasy/water-morphling-body-v2.png';info.asset=atlas.src;info.version=2;
 function frame(view,phase,rage=false){
 view=viewOf(view);if(!info.views.includes(view))view='S';phase=((phase|0)%12+12)%12;const key=view+'|'+phase+'|'+Number(rage);if(cache.has(key)){const f=cache.get(key);cache.delete(key);cache.set(key,f);return f;}
 const cv=document.createElement('canvas');cv.width=220;cv.height=164;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
 const p=parts[info.views.indexOf(view)];if(p){const scale=110/Math.max(...parts.map(p=>p.h)),w=p.w*scale,h=p.h*scale;for(let y=0;y<110;y++){const dy=y/110,flow=phase*Math.PI/6,shift=Math.round(Math.sin(flow+dy*9)*(dy>.48?1.5:.35));c.drawImage(p.image,p.x,p.y+y/110*p.h,p.w,p.h/110,-w/2+110+shift,24+y,w,1);}}
 cache.set(key,cv);info.bytes+=cv.width*cv.height*4;while(cache.size>info.maxEntries||info.bytes>info.maxBytes){const first=cache.keys().next().value,f=cache.get(first);info.bytes-=f.width*f.height*4;cache.delete(first);}return cv;
 }
 function hands(e){
   const t=Game.time,swing=e.moving?Math.sin(e.phase*.9):Math.sin(t*1.6+e.i)*.4;let front=[19,-8+swing*3],back=[-19,-9-swing*3];
   if(e.moving){front=[17+swing*5,-10+swing*4];back=[-17-swing*5,-10-swing*4];}
   if(e.state==='fight'||e.state==='smash'){const atk=e.atk?t-e.atk:9;if(atk<.35){front=[9,-50];back=[-12,-40];}else if(atk<.8){front=[24,-2];back=[-14,-16];}else{const speed=5.5;front=[20,-22+Math.sin(t*speed)*3];back=[-17,-14+Math.sin(t*speed+2)*3];}}
   if(e.state==='drag')front=waterGrabHand(e).slice();return{front,back};
 }
 const armImages=[new Image(),new Image()];
 const bodyReady=info.ready;info.ready=Promise.all([bodyReady,...armImages.map((im,i)=>new Promise(resolve=>{im.onload=resolve;im.onerror=()=>{info.errors.push('water arm '+i+' failed');resolve();};im.src='assets/fantasy/water-arm-v2-'+i+'.png';}))]);
 function arm(c,start,hand,far){
 const elbow=[(start[0]+hand[0])/2+(far?-4:4),(start[1]+hand[1])/2+3];
 const segment=(a,b,index,width)=>{const im=armImages[index];if(!im.complete||!im.naturalWidth)return;const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);c.save();c.translate(snap(a[0]),snap(a[1]));c.rotate(Math.atan2(dy,dx)-Math.PI/2);c.imageSmoothingEnabled=false;c.drawImage(im,-width/2,-2,width,len+4);c.restore();};
 segment(start,elbow,0,far?8:10);segment(elbow,hand,1,far?6:8);
 oval(c,hand[0],hand[1],3.1,2.5,P.mid);line(c,[[hand[0]-2,hand[1]-1],[hand[0]+1,hand[1]-1.5]],P.foam,.7);
 for(let k=0;k<3;k++){const x=hand[0]+1+k*.6,y=hand[1]-1+k*1.2;line(c,[[x,y],[x+3,y-2+k],[x+4,y-1+k]],P.mid,1.4);line(c,[[x,y],[x+3,y-2+k]],P.foam,.5);}
 }
 function sleepEyes(c,e,a){
   if(a<=.01)return;const t=Game.time,px=e.wx*TILE+16,py=e.wy*TILE+18+Math.sin(t*1.4+e.i)*1.2,blink=(t*.31+e.i*.17)%1<.05,rr=4+(t*3+e.i)%5;
   c.save();c.globalAlpha=a*.18;oval(c,px,py,8,4,P.light);c.globalAlpha=a*.28;oval(c,px,py,5.5,2.5,P.foam);c.globalAlpha=a;
   const pts=[];for(let i=0;i<=24;i++){const q=i/24*Math.PI*2;pts.push([px+Math.cos(q)*rr*1.4,py+2+Math.sin(q)*rr*.5]);}line(c,pts,P.shade,.5);
   for(const x of [-3,3]){oval(c,px+x,py,2,1.5,P.ink);if(!blink){rect(c,px+x-1,py-.5,2,1.5,'#b8d8bd');rect(c,px+x-1,py-.5,.5,.5,P.crest);}}
   c.restore();
 }
 function draw(c,e,forced){
   if(!parts.length)return owner.native.drawWaterEnt(c,e);
   const {bx,by,H}=waterGeom(e),k=e.k,t=Game.time;
   if(k<.3)sleepEyes(c,e,e.alpha*(1-k/.3)*Math.min(1,nightAmt()*4));
   c.save();c.globalAlpha=e.alpha;
   oval(c,bx,by,19*k+3,5.8,'rgba(30,75,81,.34)');
   for(let j=0;j<3;j++){const q=(t*.9+j*.33+e.i*.1)%1;c.globalAlpha=e.alpha*(1-q)*.42;const pts=[];for(let a=0;a<=32;a++){const r=a/32*Math.PI*2;pts.push([bx+Math.cos(r)*(9+q*17),by+Math.sin(r)*(2.6+q*4.6)]);}line(c,pts,P.light,.5);}
   c.globalAlpha=e.alpha;
   if(k>.02&&H>1){
     const dir=forced||direction(e),view=viewOf(dir),rage=['fight','smash','drag'].includes(e.state),speed=rage?5.5:e.moving?4.4:2.6,phase=Math.floor(t*speed/(Math.PI*2)*12)%12,arms=hands(e);
     c.translate(bx,by);c.scale(e.face<0?-1:1,H/40);c.imageSmoothingEnabled=R.smooth;
     const shoulders={S:[[-11,-28],[11,-29]],SE:[[-12,-29],[12,-28]],E:[[-10,-29],[10,-28]],NE:[[-12,-28],[11,-29]],N:[[-11,-29],[11,-28]]}[view];
     arm(c,shoulders[0],arms.back,true);c.drawImage(frame(view,phase,rage),-55,-67,110,82);arm(c,shoulders[1],arms.front,false);
   }
   c.restore();if(e.state==='drag'&&(e.victim||e.vsnap)){c.save();gripScope++;try{const victim=e.victim||e.vsnap,renderEntity={...e,victim:null,vsnap:{...victim}};drawVictim(c,renderEntity);}finally{gripScope--;c.restore();}}
 }
 // Strictly water-owned overlap pass; other grabbing creatures keep their renderer.
 drawGrip=function(c,hx,hy,f,k,pal,S=1){
   if(!gripScope)return nativeGrip(c,hx,hy,f,k,pal,S);
   c.save();
   for(let i=0;i<3;i++){
     const o=i-1,aOpen=o*.75-.15,aClosed=o*.16+.12,a1=aOpen+(aClosed-aOpen)*k,a2=a1+.4+1.5*k,l1=(5.6+(i===1?1:-.4))*S,l2=(4+(i===1?.6:-.3))*S;
     const x0=hx-f*1.5*S,y0=hy+o*4.6*S,x1=x0+f*Math.cos(a1)*l1,y1=y0+Math.sin(a1)*l1,x2=x1+f*Math.cos(a2)*l2,y2=y1+Math.sin(a2)*l2;
     const points=[[x0,y0],[x1,y1],[x2,y2]];line(c,points,P.ink,3.5);line(c,points,P.mid,2);line(c,points.map(([x,y])=>[x-.5,y-.5]),P.light,.8);
     oval(c,x1,y1,1.2,1,P.foam);rect(c,x2-.5,y2-.5,1,1,P.crest);
   }
   c.restore();
 };
 info.nativeGrip=nativeGrip;info.sleepEyes=sleepEyes;info.scopeDepth=()=>gripScope;
 info.frame=frame;info.resolve=direction;info.hands=hands;info.draw=draw;info.viewOf=viewOf;
 drawWaterEnt=function(c,e){return draw(c,e);};
})();
